import { test } from "node:test";
import assert from "node:assert/strict";
import { bandPath, bandPoints, type Band } from "../src/lib/guilloche";

const MARK: Band = { pattern: "core", r0: 120, r1: 330, curves: 8, lobes: 7 };
const RING: Band = { pattern: "rope", r0: 360, r1: 384, curves: 4, lobes: 40 };

test("the same band always gives the same path", () => {
  assert.equal(bandPath(MARK), bandPath({ ...MARK }));
  assert.equal(bandPath(RING), bandPath({ ...RING }));
});

test("one closed subpath per curve", () => {
  for (const band of [MARK, RING]) {
    const curves = bandPoints(band);
    assert.equal(curves.length, band.curves);
    for (const pts of curves) {
      assert.deepEqual(pts[0], pts[pts.length - 1]);
    }
    assert.equal(bandPath(band).match(/M/g)?.length, band.curves);
  }
});

test("every point stays inside its band", () => {
  for (const band of [MARK, RING]) {
    for (const pts of bandPoints(band)) {
      for (const [x, y] of pts) {
        const r = Math.hypot(x, y);
        assert.ok(r >= band.r0 - 0.1 && r <= band.r1 + 0.1, `${band.pattern}: r=${r} outside [${band.r0}, ${band.r1}]`);
      }
    }
  }
});

test("the path is rounded to 0.1 px", () => {
  const numbers = bandPath(MARK).match(/-?\d+(\.\d+)?/g) ?? [];
  assert.ok(numbers.length > 0);
  for (const n of numbers) assert.ok(!/\.\d{2,}/.test(n), `${n} has more than one decimal`);
});
