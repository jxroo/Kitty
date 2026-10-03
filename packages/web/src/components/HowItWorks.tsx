"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { PROGRAM_ID, REPO_URL } from "@/lib/kasa";
import { AddressLink, Card } from "./ui";

const SRC = `${REPO_URL}/blob/HEAD/packages/contracts/programs/kasa/src`;

function Code({ path, line, children }: { path: string; line: number; children: React.ReactNode }) {
  return (
    <a href={`${SRC}/${path}#L${line}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-sky-700 hover:underline inline-flex items-center gap-0.5">
      {children}
      <ExternalLink className="w-2.5 h-2.5" aria-hidden />
    </a>
  );
}

const ROLES: { today: string; now: React.ReactNode; code: React.ReactNode }[] = [
  {
    today: "Skarbnik trzyma pieniądze na koncie kasy (albo na swoim prywatnym)",
    now: "Skarbiec to konto należące do programu. Wypłacić z niego może tylko kod, według zasad.",
    code: <Code path="vault.rs" line={32}>vault.rs: pay_out</Code>,
  },
  {
    today: "Zarząd decyduje, kto dostanie pożyczkę",
    now: "Nikt nie zatwierdza. Pożyczka wypłaca się, gdy zablokowane oszczędności (własne + poręczenia) pokrywają 100% kwoty.",
    code: <Code path="instructions/loan.rs" line={247}>loan.rs: disburse</Code>,
  },
  {
    today: "Pracodawca potrąca raty z pensji, zarząd ściga dłużników",
    now: "Po terminie i karencji każdy może wywołać egzekucję: rata schodzi z zabezpieczeń, bez niczyjej zgody.",
    code: <Code path="instructions/repay.rs" line={100}>repay.rs: collect_overdue</Code>,
  },
  {
    today: "Zwrot oszczędności po decyzji zarządu (zwykle przy odejściu z pracy)",
    now: "Wolne oszczędności wypłacasz sam, kiedy chcesz. Kasa jest zawsze wypłacalna.",
    code: <Code path="instructions/member.rs" line={127}>member.rs: withdraw</Code>,
  },
  {
    today: "Regulamin może zmienić walne zebranie lub zarząd",
    now: "Zasady zapisane przy założeniu kasy. Nie ma instrukcji, która je zmienia, ani klucza admina.",
    code: <Code path="instructions/create_kasa.rs" line={40}>create_kasa.rs</Code>,
  },
];

export function HowItWorks() {
  return (
    <div className="space-y-5 max-w-4xl">
      <Card>
        <h2 className="font-bold text-slate-900 text-lg mb-2">Jaką relację finansową przeprojektowaliśmy?</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          <strong>Kasę zapomogowo-pożyczkową</strong> i każdą „wspólną kasę” w grupie: dział w firmie, szkołę, znajomych, rodzinę.
          Członkowie co miesiąc odkładają pieniądze i pożyczają sobie bez odsetek, a pożyczki poręczają inni członkowie (żyranci).
          Dziś to działa tylko dzięki <strong>pośrednikom</strong>: zarządowi i skarbnikowi, którzy trzymają pieniądze i decydują o
          pożyczkach, oraz pracodawcy, który potrąca raty z pensji. Trzeba im ufać, a kiedy skarbnik zniknie z pieniędzmi albo
          zarząd odmówi, nikt z członków nie ma na to wpływu.
        </p>
        <p className="text-sm text-slate-700 leading-relaxed mt-2">
          W <strong>Kasie bez zarządu</strong> te role przejmuje program na Solanie. Strona A (pożyczkobiorca) nie musi ufać stronie B
          (poręczycielom i reszcie kasy), bo obie polegają na regule zapisanej w programie, której żadna instrukcja nie pozwala obejść – także nam, autorom.
        </p>
      </Card>

      <Card>
        <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-3">Gdzie dokładnie znika pośrednik</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="font-medium pb-2 pr-3">Dziś (KZP / skarbnik)</th>
                <th className="font-medium pb-2 pr-3">Kasa bez zarządu</th>
                <th className="font-medium pb-2">Kod</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.today} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-600">{r.today}</td>
                  <td className="py-2 pr-3 text-slate-900">{r.now}</td>
                  <td className="py-2">{r.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <h2 className="font-bold text-emerald-900 text-sm mb-2">Dlaczego kasa nigdy nie traci</h2>
          <ul className="text-xs text-emerald-900 space-y-1.5 list-disc list-inside">
            <li>Pożyczka wypłaca się tylko, gdy zablokowane oszczędności pokrywają ją w 100%.</li>
            <li>Każda spłata od razu odblokowuje tyle samo zabezpieczenia: najpierw poręczycielom.</li>
            <li>Zaległa rata schodzi z zabezpieczeń: najpierw z oszczędności pożyczkobiorcy, potem proporcjonalnie z poręczeń.</li>
            <li>
              Dlatego zawsze: <strong>skarbiec = oszczędności − pożyczone</strong>, a wolne oszczędności każdego członka zawsze
              leżą w skarbcu. Testy sprawdzają to po każdym kroku, łącznie z „runem na kasę”.
            </li>
            <li>Ryzyko ponosi tylko poręczyciel, który sam się na nie zgodził – jak żyrant w KZP.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-bold text-slate-900 text-sm mb-2">Co jeśli ktoś zniknie w połowie?</h2>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
            <li><strong>Pożyczkobiorca przestaje płacić:</strong> raty i tak trafiają do kasy z jego zablokowanych oszczędności, a potem z poręczeń. Wystarczy, że ktokolwiek kliknie „Egzekwuj”.</li>
            <li><strong>Poręczyciel znika:</strong> nic nie musi robić. Poręczenie odblokuje się samo, gdy pożyczka zostanie spłacona.</li>
            <li><strong>Założyciel znika:</strong> nie ma żadnych uprawnień, więc nic się nie zmienia.</li>
            <li><strong>My i ta strona znikamy:</strong> program i jego IDL są na łańcuchu. Każdy może zbudować transakcje sam.</li>
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="font-bold text-slate-900 text-sm mb-2">Kto może co</h2>
        <table className="w-full text-xs">
          <tbody className="[&_td]:py-1.5 [&_tr]:border-t [&_tr]:border-slate-100">
            <tr><td className="text-slate-600 pr-3">Założyć kasę i ustalić zasady</td><td className="text-slate-900">Każdy, raz. Potem założyciel jest zwykłym członkiem.</td></tr>
            <tr><td className="text-slate-600 pr-3">Dołączyć, wpłacać, wypłacać wolne oszczędności</td><td className="text-slate-900">Każdy członek, sam za siebie</td></tr>
            <tr><td className="text-slate-600 pr-3">Poprosić o pożyczkę</td><td className="text-slate-900">Członek bez otwartej pożyczki, do limitu kasy</td></tr>
            <tr><td className="text-slate-600 pr-3">Poręczyć</td><td className="text-slate-900">Inny członek, z własnych wolnych oszczędności</td></tr>
            <tr><td className="text-slate-600 pr-3">Wypłacić pożyczkę / anulować wniosek</td><td className="text-slate-900">Tylko pożyczkobiorca</td></tr>
            <tr><td className="text-slate-600 pr-3">Spłacić</td><td className="text-slate-900">Każdy (także za kogoś)</td></tr>
            <tr><td className="text-slate-600 pr-3">Egzekwować zaległą ratę</td><td className="text-slate-900">Każdy, po terminie + karencji</td></tr>
            <tr><td className="text-slate-600 pr-3">Zmienić zasady, zamrozić lub przelać cudze środki</td><td className="text-slate-900 font-semibold">Żadna instrukcja na to nie pozwala, także nam</td></tr>
          </tbody>
        </table>
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">
          Uczciwie: na devnecie kod programu może jeszcze zaktualizować klucz autorów (upgrade authority). Trzymamy go na czas
          hackathonu, żeby móc poprawiać błędy. Przed prawdziwymi pieniędzmi trafi do multisiga przedstawicieli członków albo
          zostanie usunięty na zawsze.
        </p>
        <p className="text-[11px] text-slate-500 mt-3">
          Program: <AddressLink address={PROGRAM_ID} /> ·{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
            kod źródłowy
          </a>
        </p>
      </Card>

      <Card>
        <h2 className="font-bold text-slate-900 text-sm mb-2">Dlaczego blockchain, a nie zwykła baza danych?</h2>
        <p className="text-xs text-slate-700 leading-relaxed">
          Bo w bazie danych pośrednikiem jest ten, kto ją prowadzi: może zmienić saldo, zatrzymać wypłatę albo „pożyczyć” sobie z
          kasy. Tu saldo to konto tokenowe programu, zasady to kod, którego nikt nie może podmienić, a każdy członek widzi każdą
          operację w czasie rzeczywistym. Egzekucja raty nie potrzebuje zaufanego serwera, bo może ją uruchomić każdy.
        </p>
      </Card>
    </div>
  );
}
