// Synthesises the teaser's and the trailer's sound effects into public/sfx/*.wav (48 kHz, 16-bit stereo).
// No samples, no licences, no dependencies; a seeded noise source keeps every run byte-identical.
//   node scripts/make-sfx.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SR = 48000;
const OUT = resolve(import.meta.dirname, "../public/sfx");

function rng(seed) {
  // mulberry32
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise = (seed) => {
  const r = rng(seed);
  return () => r() * 2 - 1;
};

/** Chamberlin state-variable band-pass, retunable per sample. */
function bandpass() {
  let low = 0;
  let band = 0;
  return (x, fc, q) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return band;
  };
}

function onePoleLow(fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  return (x) => (y = (1 - a) * x + a * y);
}

function render(seconds, fn) {
  const n = Math.round(seconds * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [l, r] = fn(i / SR, i);
    L[i] = l;
    R[i] = r;
  }
  return [L, R];
}

function normalize([L, R], peakDb = -3) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = 10 ** (peakDb / 20) / peak;
  // 3 ms fade-out so no file ends on a click.
  const fade = Math.round(0.003 * SR);
  for (let i = 0; i < L.length; i++) {
    const tail = Math.min(1, (L.length - 1 - i) / fade);
    L[i] *= gain * tail;
    R[i] *= gain * tail;
  }
  return [L, R];
}

function writeWav(name, [L, R]) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(resolve(OUT, `${name}.wav`), buf);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  console.log(`${name}.wav  ${(n / SR).toFixed(2)} s  peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
}

// Air moving past the camera: band-passed noise sweeping up and back down, panning left → right.
const whoosh = () => {
  const nz = noise(7);
  const bp1 = bandpass();
  const bp2 = bandpass();
  const PEAK = 0.42;
  return render(1.1, (t) => {
    const x = nz();
    const sweep = t < PEAK ? t / PEAK : Math.max(0, 1 - (t - PEAK) / 0.9);
    const fc = 260 * (2600 / 260) ** sweep;
    const env = t < PEAK ? (t / PEAK) ** 2.2 : Math.exp(-(t - PEAK) * 6);
    const s = (bp1(x, fc, 1.3) + 0.35 * bp2(x, fc * 1.8, 0.35)) * env;
    const pan = 0.3 + 0.4 * Math.min(1, t / 0.9);
    return [s * Math.cos((pan * Math.PI) / 2), s * Math.sin((pan * Math.PI) / 2)];
  });
};

// A glassy UI tick.
const tick = () => {
  const nz = noise(11);
  return render(0.09, (t) => {
    const s =
      Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t / 0.006) +
      0.4 * Math.sin(2 * Math.PI * 4800 * t) * Math.exp(-t / 0.003) +
      0.3 * nz() * Math.exp(-t / 0.0008);
    return [s, s];
  });
};

// A trackpad click: a bright transient over a short wooden body.
const click = () => {
  const nz = noise(23);
  let prev = 0;
  let hp = 0;
  return render(0.12, (t) => {
    const x = nz();
    hp = 0.82 * (hp + x - prev);
    prev = x;
    const s =
      0.6 * hp * Math.exp(-t / 0.002) +
      0.5 * Math.sin(2 * Math.PI * 1700 * t) * Math.exp(-t / 0.01) +
      0.6 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t / 0.018);
    return [s, s];
  });
};

// A soft cinematic low hit for reveals: pitched-down sub, a muffled thump, a faint airy tail.
const hit = () => {
  const thump = noise(31);
  const airL = noise(41);
  const airR = noise(43);
  const lp = onePoleLow(380);
  const bpL = bandpass();
  const bpR = bandpass();
  let phase = 0;
  return render(2.4, (t) => {
    phase += (2 * Math.PI * (44 + 72 * Math.exp(-t / 0.06))) / SR;
    const attack = Math.min(1, t / 0.002);
    const sub = Math.sin(phase) * Math.exp(-t / 0.55) * attack;
    const body = 0.55 * lp(thump()) * Math.exp(-t / 0.05) * attack;
    const tail = Math.exp(-t / 0.45) * 0.06;
    return [sub + body + tail * bpL(airL(), 3200, 0.6), sub + body + tail * bpR(airR(), 3400, 0.6)];
  });
};

// A two-note ascending chime (G5 → C6) for "covered 100 %", slightly detuned between ears for width.
const chime = () => {
  const partials = [
    [1, 1, 0.9],
    [1.5, 0.5, 0.6],
    [2, 0.32, 0.42],
    [3, 0.1, 0.28],
  ];
  const note = (t, f0, detune) => {
    if (t < 0) return 0;
    const attack = Math.min(1, t / 0.004);
    return partials.reduce((s, [mul, amp, tau]) => s + amp * Math.sin(2 * Math.PI * (f0 * mul + detune) * t) * Math.exp(-t / tau), 0) * attack;
  };
  return render(2.2, (t) => [
    0.8 * note(t, 783.99, 0) + note(t - 0.09, 1046.5, 0),
    0.8 * note(t, 783.99, 0.7) + note(t - 0.09, 1046.5, 0.9),
  ]);
};


// ───────────── Trailer sounds (t-*): richer, stereo, with a synthetic room ─────────────

/** Freeverb (Jezar's tunings at 48 kHz): 8 damped combs + 4 allpasses per ear, right ear detuned for width. */
function reverb([L, R], { room = 0.86, damp = 0.35, wet = 0.32, dry = 1, tail = 1.5 } = {}) {
  const pad = Math.round(tail * SR);
  const n = L.length + pad;
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apT = [556, 441, 341, 225];
  const make = (spread) => ({
    combs: combT.map((t) => ({ buf: new Float32Array(Math.round((t + spread) * scale)), i: 0, store: 0 })),
    aps: apT.map((t) => ({ buf: new Float32Array(Math.round((t + spread) * scale)), i: 0 })),
  });
  const ears = [make(0), make(23)];
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const xl = k < L.length ? L[k] : 0;
    const xr = k < R.length ? R[k] : 0;
    const input = (xl + xr) * 0.015;
    const res = ears.map((ear) => {
      let acc = 0;
      for (const c of ear.combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = input + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (const a of ear.aps) {
        const b = a.buf[a.i];
        const y = -acc + b;
        a.buf[a.i] = acc + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        acc = y;
      }
      return acc;
    });
    outL[k] = xl * dry + res[0] * wet * 3;
    outR[k] = xr * dry + res[1] * wet * 3;
  }
  return [outL, outR];
}

const pan = (s, p) => [s * Math.cos((p * Math.PI) / 2), s * Math.sin((p * Math.PI) / 2)];

// Camera fly-through: a deep, slow air rush that crosses the stereo field.
const tFly = () => {
  const nz = noise(101);
  const a = bandpass();
  const b = bandpass();
  const lp = onePoleLow(900);
  const PEAK = 0.55;
  return reverb(
    render(1.3, (t) => {
      const x = nz();
      const sweep = t < PEAK ? t / PEAK : Math.max(0, 1 - (t - PEAK) / 0.75);
      const fc = 140 * (1500 / 140) ** sweep;
      const env = t < PEAK ? (t / PEAK) ** 2.4 : Math.exp(-(t - PEAK) * 5);
      const s = (a(x, fc, 1.1) + 0.5 * b(x, fc * 2.2, 0.5) + 0.6 * lp(x) * sweep) * env;
      return pan(s, 0.15 + 0.7 * Math.min(1, t / 1.0));
    }),
    { wet: 0.22, tail: 1.2 },
  );
};

// Tension before the bloom: rising noise and a gliding tone with a quickening tremolo, cut at the top.
const tRiser = () => {
  const nz = noise(111);
  const bp = bandpass();
  let ph1 = 0;
  let ph2 = 0;
  const D = 2.2;
  return reverb(
    render(D, (t) => {
      const u = t / D;
      const env = u ** 2.2 * Math.min(1, (D - t) / 0.02);
      const f = 110 * 2 ** (u * 3);
      ph1 += (2 * Math.PI * f) / SR;
      ph2 += (2 * Math.PI * f * 1.503) / SR;
      const trem = 0.75 + 0.25 * Math.sin(2 * Math.PI * (4 + 18 * u * u) * t);
      const tone = (Math.sin(ph1) + 0.4 * Math.sin(ph2)) * 0.35;
      const air = bp(nz(), 260 * 2 ** (u * 2.6), 0.8) * 0.7;
      const s = (tone + air) * env * trem;
      return [s * (1 - 0.15 * Math.sin(t * 3)), s * (1 + 0.15 * Math.sin(t * 3))];
    }),
    { wet: 0.28, tail: 1.6 },
  );
};

// The big reveal: sub drop + body + bright transient, in a large hall.
const tImpact = () => {
  const nz = noise(121);
  const lp = onePoleLow(300);
  let phase = 0;
  return reverb(
    render(2.6, (t) => {
      phase += (2 * Math.PI * (38 + 90 * Math.exp(-t / 0.05))) / SR;
      const attack = Math.min(1, t / 0.0015);
      const sub = Math.sin(phase) * Math.exp(-t / 0.7) * attack;
      const body = 0.7 * lp(nz()) * Math.exp(-t / 0.06) * attack;
      const crack = 0.25 * nz() * Math.exp(-t / 0.006);
      const s = sub + body + crack;
      return [s, s];
    }),
    { room: 0.9, damp: 0.25, wet: 0.4, tail: 3 },
  );
};

// Glassy tick in a small room (list items, rows, chips).
const tTick = () => {
  const nz = noise(131);
  return reverb(
    render(0.1, (t) => {
      const s =
        Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t / 0.007) +
        0.45 * Math.sin(2 * Math.PI * 4300 * t) * Math.exp(-t / 0.003) +
        0.25 * nz() * Math.exp(-t / 0.0007);
      return [s, s];
    }),
    { room: 0.7, damp: 0.5, wet: 0.25, tail: 0.7 },
  );
};

// A soft, woody pop for things landing (chips, statement rows).
const tPop = () =>
  reverb(
    render(0.16, (t) => {
      const f = 520 * Math.exp(-t / 0.03) + 240;
      const s = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.035) * Math.min(1, t / 0.002);
      return [s, s];
    }),
    { room: 0.7, damp: 0.5, wet: 0.2, tail: 0.6 },
  );

// Trackpad click with a little room.
const tClick = () => reverb(click(), { room: 0.6, damp: 0.5, wet: 0.15, tail: 0.5 });

// Clock: alternating tick / tock.
const tClock = (hi) => {
  const nz = noise(hi ? 141 : 142);
  const bp = bandpass();
  return reverb(
    render(0.12, (t) => {
      const s = bp(nz(), hi ? 3200 : 2300, 0.15) * Math.exp(-t / 0.008) * 2 + 0.3 * Math.sin(2 * Math.PI * (hi ? 1600 : 1150) * t) * Math.exp(-t / 0.015);
      return [s, s];
    }),
    { room: 0.75, damp: 0.4, wet: 0.3, tail: 0.8 },
  );
};

// Money moving: a rising shimmer sweep that lands on a soft bell.
const tTransfer = () => {
  const nz = noise(151);
  const bp = bandpass();
  const D = 1.6;
  return reverb(
    render(D, (t) => {
      const u = Math.min(1, t / 0.9);
      const sweepEnv = t < 0.9 ? u ** 1.6 : Math.exp(-(t - 0.9) * 14);
      const sweep = bp(nz(), 500 * 2 ** (u * 1.8), 0.4) * sweepEnv * 0.7;
      const bt = t - 0.9;
      const bell =
        bt < 0
          ? 0
          : [1, 2.01, 3.02, 4.1].reduce((s, m, i) => s + Math.sin(2 * Math.PI * 659.25 * m * bt) * Math.exp(-bt / (0.6 / (i + 1))) * [1, 0.45, 0.25, 0.1][i], 0) *
            Math.min(1, bt / 0.003) * 0.5;
      return pan(sweep + bell, 0.2 + 0.6 * u);
    }),
    { wet: 0.32, tail: 1.8 },
  );
};

// A bright, airy swell (the ✓ moments): high partials and filtered air.
const tShimmer = () => {
  const nz = noise(161);
  const bp = bandpass();
  const D = 1.8;
  return reverb(
    render(D, (t) => {
      const env = Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.25) * 2.2);
      const tone = [2093, 2637, 3136, 4186].reduce((s, f, i) => s + Math.sin(2 * Math.PI * f * t + i) * 0.18, 0);
      const air = bp(nz(), 7000, 0.4) * 0.35;
      const s = (tone + air) * env;
      return [s * (1 + 0.2 * Math.sin(t * 9)), s * (1 - 0.2 * Math.sin(t * 9))];
    }),
    { room: 0.88, wet: 0.4, tail: 2 },
  );
};

// Success chime (G5 → C6) in a hall.
const tChime = () => reverb(chime(), { room: 0.86, damp: 0.3, wet: 0.3, tail: 1.8 });

// A quick swipe for strip transitions: band-passed air sweeping up, optionally travelling across the stereo field.
const tSwipe = (panFrom, panTo) => {
  const nz = noise(171);
  const bp = bandpass();
  const PEAK = 0.2;
  return reverb(
    render(0.5, (t) => {
      const u = Math.min(1, t / 0.45);
      const env = t < PEAK ? (t / PEAK) ** 1.8 : Math.exp(-(t - PEAK) * 14);
      const s = bp(nz(), 260 * 2 ** (u * 2.6), 0.9) * env;
      return pan(s, panFrom + (panTo - panFrom) * u);
    }),
    { room: 0.7, wet: 0.18, tail: 0.6 },
  );
};

// A dry, low knock for hard cuts and punched words.
const tThud = () => {
  const nz = noise(181);
  const lp = onePoleLow(500);
  let phase = 0;
  return reverb(
    render(0.3, (t) => {
      phase += (2 * Math.PI * (52 + 60 * Math.exp(-t / 0.025))) / SR;
      const s = Math.sin(phase) * Math.exp(-t / 0.09) * Math.min(1, t / 0.001) + 0.5 * lp(nz()) * Math.exp(-t / 0.012);
      return [s, s];
    }),
    { room: 0.55, damp: 0.6, wet: 0.12, tail: 0.4 },
  );
};

// A small metallic coin: inharmonic partials with a quick decay.
const tCoin = () =>
  reverb(
    render(0.6, (t) => {
      const s = [
        [2637, 1, 0.18],
        [2637 * 2.76, 0.5, 0.09],
        [2637 * 5.4, 0.22, 0.05],
      ].reduce((acc, [f, a, tau]) => acc + a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau), 0) * Math.min(1, t / 0.001);
      return [s, s];
    }),
    { room: 0.75, damp: 0.35, wet: 0.22, tail: 0.8 },
  );

mkdirSync(OUT, { recursive: true });
writeWav("whoosh", normalize(whoosh()));
writeWav("tick", normalize(tick()));
writeWav("click", normalize(click()));
writeWav("hit", normalize(hit()));
writeWav("chime", normalize(chime()));
writeWav("t-fly", normalize(tFly()));
writeWav("t-riser", normalize(tRiser()));
writeWav("t-impact", normalize(tImpact()));
writeWav("t-tick", normalize(tTick()));
writeWav("t-pop", normalize(tPop()));
writeWav("t-click", normalize(tClick()));
writeWav("t-clock-hi", normalize(tClock(true)));
writeWav("t-clock-lo", normalize(tClock(false)));
writeWav("t-transfer", normalize(tTransfer()));
writeWav("t-shimmer", normalize(tShimmer()));
writeWav("t-chime", normalize(tChime()));
writeWav("t-swipe", normalize(tSwipe(0.5, 0.5)));
writeWav("t-swipe-lr", normalize(tSwipe(0.85, 0.15)));
writeWav("t-thud", normalize(tThud()));
writeWav("t-coin", normalize(tCoin()));
