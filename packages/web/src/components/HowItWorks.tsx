"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { PROGRAM_ID, REPO_URL } from "@/lib/kasa";
import { AddressLink, Card, Kicker, LINK } from "./ui";

const SRC = `${REPO_URL}/blob/HEAD/packages/contracts/programs/kasa/src`;
const WEB = `${REPO_URL}/blob/HEAD/packages/web`;

function Code({ path, line, children, web = false }: { path: string; line: number; children: React.ReactNode; web?: boolean }) {
  return (
    <a href={`${web ? WEB : SRC}/${path}#L${line}`} target="_blank" rel="noreferrer" className={LINK}>
      {children}
      <ExternalLink className="w-2.5 h-2.5" aria-hidden />
    </a>
  );
}

const ROLES: { today: string; now: React.ReactNode; code: React.ReactNode }[] = [
  {
    today: "Skarbnik trzyma pieniądze na koncie kasy (albo na swoim prywatnym)",
    now: "Skarbiec to konto należące do programu. Wypłacić z niego może tylko kod, według zasad.",
    code: <Code path="vault.rs" line={35}>vault.rs: pay_out</Code>,
  },
  {
    today: "Zarząd (albo bank) decyduje, kto dostanie pożyczkę",
    now: "Nikt nie zatwierdza. Pożyczka wypłaca się, gdy zablokowane oszczędności (własne + poręczenia) pokrywają 100% kwoty.",
    code: <Code path="instructions/loan.rs" line={248}>loan.rs: disburse</Code>,
  },
  {
    today: "Pracodawca potrąca raty z pensji; bank realizuje polecenie zapłaty",
    now: (
      <>
        Pożyczkobiorca daje zgodę SPL swojemu kontu w kasie. W dniu terminu każdy (w praktyce automat) może pobrać z jego portfela{" "}
        <strong>tylko wymagalną ratę</strong>, tylko z jego konta i tylko w limicie zgody. Zgodę cofa jednym kliknięciem.
      </>
    ),
    code: (
      <span className="flex flex-col gap-0.5">
        <Code path="instructions/autopay.rs" line={57}>autopay.rs: pull_installment</Code>
        <Code path="vault.rs" line={64}>vault.rs: mandate_available</Code>
      </span>
    ),
  },
  {
    today: "Firma windykacyjna ściga dłużników",
    now: "Nie ma zgody albo pieniędzy w portfelu? Po terminie i karencji każdy może wywołać egzekucję: rata schodzi z zabezpieczeń, bez niczyjej zgody.",
    code: <Code path="instructions/repay.rs" line={96}>repay.rs: collect_overdue</Code>,
  },
  {
    today: "Bank realizuje stałe zlecenie oszczędzania",
    now: "Składka stała: raz na okres każdy (automat) może przenieść ustaloną kwotę z portfela członka do jego oszczędności, w limicie zgody.",
    code: <Code path="instructions/autopay.rs" line={142}>autopay.rs: pull_contribution</Code>,
  },
  {
    today: "BIK mówi, czy ktoś spłaca długi",
    now: "Historia każdego pożyczkobiorcy jest w kontach pożyczek na łańcuchu, w całej sieci kas. Poręczyciel widzi ją przed poręczeniem. To informacja, nie reguła: program jej nie używa.",
    code: (
      <Code path="src/lib/history.ts" line={33} web>
        history.ts: creditHistory
      </Code>
    ),
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

const SIMPLE: { today: string; here: string }[] = [
  { today: "Skarbnik trzyma pieniądze kasy (czasem na swoim prywatnym koncie)", here: "Pieniądze leżą na koncie programu. Nikt nie może ich wziąć dla siebie." },
  { today: "Zarząd albo bank decyduje, kto dostanie pożyczkę", here: "Nikt nie decyduje. Pożyczka się wypłaca, gdy Twoje oszczędności i poręczenia innych pokrywają całą kwotę." },
  { today: "Pracodawca potrąca raty z pensji, bank realizuje polecenie zapłaty", here: "W dniu terminu rata sama schodzi z portfela pożyczkobiorcy – dokładnie tyle, ile trzeba." },
  { today: "Windykacja ściga tych, którzy nie płacą", here: "Niezapłacona rata jest pokrywana z zablokowanych oszczędności. Nikogo nie trzeba ścigać." },
  { today: "Bank realizuje stałe zlecenie oszczędzania", here: "Stała składka przelewa się z portfela do kasy co okres, sama." },
  { today: "BIK mówi, czy ktoś spłaca długi", here: "Historia spłat każdej osoby jest publiczna. Zanim poręczysz, widzisz ją w aplikacji." },
  { today: "Na zwrot oszczędności czeka się na zgodę zarządu", here: "Wolne pieniądze wyjmujesz, kiedy chcesz, bez pytania kogokolwiek." },
];

export function HowItWorks() {
  return (
    <div className="space-y-5 max-w-4xl">
      <Card className="bg-navy border-navy">
        <h2 className="font-extrabold text-cream text-xl tracking-[-0.03em] mb-3">Jak to działa – w 5 zdaniach</h2>
        <ol className="space-y-2.5 text-sm text-slate-200 leading-relaxed list-decimal list-inside marker:font-mono marker:font-semibold marker:text-mint">
          <li>Grupa ludzi odkłada pieniądze do wspólnej kasy. Leżą na koncie programu, nie u skarbnika ani w banku.</li>
          <li>
            Każdy może pożyczyć kilka razy tyle, ile ma odłożone – bez odsetek i bez niczyjej zgody. Warunek: jego oszczędności i
            poręczenia innych członków muszą pokryć całą pożyczkę.
          </li>
          <li>Raty i składki mogą płacić się same: w dniu terminu program pobiera z portfela dokładnie tyle, ile trzeba.</li>
          <li>
            Kto nie zapłaci raty, traci swoje zablokowane oszczędności; jeśli to za mało – tracą ci, którzy za tę osobę poręczyli.
            Kasa nigdy nie traci, a pieniądze pozostałych są bezpieczne.
          </li>
          <li>Zasad nie może zmienić nikt: ani założyciel, ani członkowie, ani my – autorzy.</li>
        </ol>
      </Card>

      <Card className="bg-navy border-navy">
        <Kicker tone="dark" className="mb-3">
          Gdzie dokładnie znika pośrednik
        </Kicker>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em]">
                <th className="font-semibold text-slate-400 pb-2 pr-4 w-1/2">Dziś</th>
                <th className="font-semibold text-mint pb-2 pl-4">W Kasie bez zarządu</th>
              </tr>
            </thead>
            <tbody>
              {SIMPLE.map((r) => (
                <tr key={r.today} className="border-t border-white/10 align-top">
                  <td className="py-2.5 pr-4 font-serif text-sm leading-snug text-slate-300">{r.today}</td>
                  <td className="py-2.5 pl-4 border-l border-line/50 text-cream font-medium">{r.here}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <h2 className="font-bold text-emerald-900 text-sm mb-2">Dlaczego kasa nigdy nie traci</h2>
          <ul className="text-xs text-emerald-900 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>Pożyczka wypłaca się tylko wtedy, gdy zablokowane oszczędności pokrywają ją w całości.</li>
            <li>Każda spłacona rata odblokowuje tyle samo – najpierw poręczającym.</li>
            <li>Niezapłacona rata jest brana z zablokowanych oszczędności: najpierw pożyczkobiorcy, potem poręczających.</li>
            <li>Dlatego w kasie zawsze leżą wszystkie wolne pieniądze członków – każdy może je wyjąć w dowolnej chwili.</li>
            <li>Ryzykuje tylko ten, kto sam zgodził się poręczyć – i najwyżej tyle, ile poręczył.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-bold text-slate-900 text-sm mb-2">Co jeśli ktoś zniknie?</h2>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>Pożyczkobiorca przestaje płacić:</strong> raty i tak wracają do kasy – z jego zablokowanych oszczędności, potem z
              poręczeń.
            </li>
            <li>
              <strong>Poręczający znika:</strong> nic nie musi robić. Jego pieniądze odblokują się same, gdy pożyczka zostanie spłacona.
            </li>
            <li>
              <strong>Automat przestaje działać:</strong> nic się nie psuje. Nie ma żadnych uprawnień – te same przyciski są w aplikacji
              dla każdego.
            </li>
            <li>
              <strong>Założyciel, my albo ta strona znikamy:</strong> pieniądze i zasady są na Solanie. Kasa działa dalej.
            </li>
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="font-bold text-slate-900 text-sm mb-2">Dlaczego nie zwykła aplikacja z bazą danych?</h2>
        <p className="text-xs text-slate-700 leading-relaxed">
          Bo wtedy pośrednikiem jest ten, kto prowadzi bazę: może zmienić komuś saldo, wstrzymać wypłatę albo „pożyczyć” sobie z
          kasy – dokładnie tak znikały pieniądze z kas zapomogowo-pożyczkowych. Tutaj pieniądze leżą na koncie programu, zasady to
          publiczny kod, którego nikt nie obejdzie, a każdy widzi każdą operację w historii kasy.
        </p>
      </Card>

      <details className="group bg-white border border-slate-200 rounded-xl">
        <summary className="cursor-pointer px-4 py-3 font-bold text-slate-900 text-sm">
          Dla jury i programistów: gdzie to jest w kodzie, kto może co, czego musicie nam ufać
        </summary>
        <div className="px-4 pb-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="font-medium pb-2 pr-3">Dziś</th>
                  <th className="font-medium pb-2 pr-3">Reguła programu</th>
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

          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Kto może co</h3>
            <table className="w-full text-xs">
              <tbody className="[&_td]:py-1.5 [&_tr]:border-t [&_tr]:border-slate-100">
                <tr><td className="text-slate-600 pr-3">Założyć kasę i ustalić zasady</td><td className="text-slate-900">Każdy, raz. Potem założyciel jest zwykłym członkiem.</td></tr>
                <tr><td className="text-slate-600 pr-3">Dołączyć, wpłacać, wypłacać wolne oszczędności</td><td className="text-slate-900">Każdy członek, sam za siebie</td></tr>
                <tr><td className="text-slate-600 pr-3">Poprosić o pożyczkę / poręczyć</td><td className="text-slate-900">Członkowie, w limitach kasy (nie za siebie)</td></tr>
                <tr><td className="text-slate-600 pr-3">Wypłacić pożyczkę / zrezygnować</td><td className="text-slate-900">Tylko pożyczkobiorca</td></tr>
                <tr><td className="text-slate-600 pr-3">Włączyć lub wyłączyć płatności automatyczne</td><td className="text-slate-900">Tylko właściciel portfela (standardowe SPL approve / revoke)</td></tr>
                <tr><td className="text-slate-600 pr-3">Pobrać ratę albo składkę automatycznie</td><td className="text-slate-900">Każdy (np. automat): tylko kwotę wymagalną, tylko z portfela tej osoby, w limicie jej zgody</td></tr>
                <tr><td className="text-slate-600 pr-3">Spłacić, pokryć zaległą ratę z oszczędności</td><td className="text-slate-900">Każdy (zaległą: po czasie na spóźnienie)</td></tr>
                <tr><td className="text-slate-600 pr-3">Zmienić zasady, zamrozić lub przelać cudze środki</td><td className="text-slate-900 font-semibold">Żadna instrukcja na to nie pozwala, także nam</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Uczciwie: na devnecie kod programu może jeszcze zaktualizować klucz autorów (upgrade authority). Trzymamy go na czas
            hackathonu, żeby móc poprawiać błędy. Przed prawdziwymi pieniędzmi trafi do multisiga przedstawicieli członków albo
            zostanie usunięty na zawsze.
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Polecenie zapłaty w banku wymaga banku, któremu ufają obie strony. Tu limit zgody pilnuje program SPL Token, kwotę i
            termin – nasz program, a automat, który wysyła transakcję, może tylko to, co i tak wolno każdemu.
          </p>
          <p className="text-[11px] text-slate-500">
            Program: <AddressLink address={PROGRAM_ID} /> ·{" "}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={LINK}>
              kod źródłowy
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}
