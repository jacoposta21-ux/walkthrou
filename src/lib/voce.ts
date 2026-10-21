import type { Vasca } from "./types";

export type CampoVoce = "ph" | "temp" | "livello_cm" | "od750" | "diluizione" | "note";

export const CAMPI_VOCE: Record<CampoVoce, { nome: string; unita: string }> = {
  ph: { nome: "pH", unita: "" },
  temp: { nome: "Temperatura", unita: "°C" },
  livello_cm: { nome: "Altezza liquido", unita: "cm" },
  od750: { nome: "OD750", unita: "" },
  diluizione: { nome: "Diluizione", unita: "×" },
  note: { nome: "Nota", unita: "" },
};

export interface LetturaVoce {
  vasca_id: string | null;
  vasca_detta: string;
  campo: CampoVoce;
  valore: number | string;
  testo: string;
}

/* ---------- Italian number words → digits ---------- */
const UNITA: Record<string, number> = {
  zero: 0, uno: 1, un: 1, una: 1, due: 2, tre: 3, "tré": 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19,
};
const DECINE: Record<string, number> = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 };

/** "ventitré" → 23, "centoquindici" → 115; null when the word is not a number. */
export function parolaNumero(w: string): number | null {
  w = w.normalize("NFC");
  if (w in UNITA) return UNITA[w];
  let tot = 0;
  let rest = w;
  if (rest.startsWith("cento")) { tot += 100; rest = rest.slice(5); }
  else {
    const m = rest.match(/^(due|tre|quattro|cinque|sei|sette|otto|nove)cento/);
    if (m) { tot += UNITA[m[1]] * 100; rest = rest.slice(m[0].length); }
  }
  if (!rest) return tot || null;
  if (rest in UNITA) return tot + UNITA[rest];
  for (const [d, v] of Object.entries(DECINE)) {
    const stem = d.slice(0, -1); // "vent", "trent": vowel drops before uno/otto
    if (rest === d) return tot + v;
    for (const base of [d, stem]) {
      if (rest.startsWith(base)) {
        const u = rest.slice(base.length);
        if (u in UNITA && UNITA[u] < 10) return tot + v + UNITA[u];
      }
    }
  }
  return null;
}

/** Rewrites spoken numbers as digits: "dieci virgola due" → "10,2", "dieci e mezzo" → "10,5". */
export function normalizzaNumeri(testo: string): string {
  const parole = testo.toLowerCase().replace(/[.!?;:]+(\s|$)/g, " , ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parole.length; i++) {
    const n = parolaNumero(parole[i]);
    if (n === null) { out.push(parole[i]); continue; }
    let s = String(n);
    if ((parole[i + 1] === "virgola" || parole[i + 1] === "punto") && i + 2 < parole.length) {
      // decimals: either one number word ("ventitré") or a run of digit words ("zero cinque")
      const dec: string[] = [];
      let j = i + 2;
      while (j < parole.length) {
        const d = /^\d+$/.test(parole[j]) ? Number(parole[j]) : parolaNumero(parole[j]);
        if (d === null) break;
        dec.push(String(d));
        j++;
        if (d >= 10) break;
      }
      if (dec.length) { s += "," + dec.join(""); i = j - 1; }
    } else if (parole[i + 1] === "e" && parole[i + 2] === "mezzo") { s += ",5"; i += 2; }
    out.push(s);
  }
  return out.join(" ").replace(/(\d)\s*[.,]\s*(\d)/g, "$1,$2");
}

/* ---------- rule-based parser (used when the AI is unavailable) ---------- */
const CAMPI_RE: [CampoVoce, RegExp][] = [
  ["ph", /\b(ph|p h|piacca|pi acca|p acca|piaca)\b/],
  ["temp", /\b(temperatura|temp|gradi)\b/],
  ["livello_cm", /\b(altezza|livello|alta|alto)\b/],
  ["od750", /\b(od|o d|densità ottica|densita ottica|assorbanza|densità|densita|ottica)\b/],
  ["diluizione", /\b(diluizione|diluito|diluita|diluizioni)\b/],
];
const NUMERO = /-?\d+(?:,\d+)?/;

const trovaVasche = (testo: string, vasche: Vasca[]) => {
  const hit: { pos: number; fine: number; vasca: Vasca | null; detto: string }[] = [];
  for (const m of testo.matchAll(/\b(vasca|vasche|la|nella)\s+(?:numero\s+)?(\d+)\b/g)) {
    const n = Number(m[2]);
    hit.push({ pos: m.index!, fine: m.index! + m[0].length, vasca: vasche.find((v) => v.numero === n) ?? null, detto: m[0] });
  }
  for (const v of vasche) {
    for (const nome of [v.nome, ...v.alias].map((s) => s.toLowerCase().trim()).filter((s) => s && !/^vasca \d+$/.test(s))) {
      const re = new RegExp(`\\b${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      for (const m of testo.matchAll(re)) hit.push({ pos: m.index!, fine: m.index! + m[0].length, vasca: v, detto: m[0] });
    }
  }
  return hit.sort((a, b) => a.pos - b.pos).filter((h, i, arr) => i === 0 || h.pos >= arr[i - 1].fine);
};

export function interpretaLocale(trascrizione: string, vasche: Vasca[]): { letture: LetturaVoce[]; non_capito: string[] } {
  const testo = normalizzaNumeri(trascrizione);
  const hits = trovaVasche(testo, vasche);
  const letture: LetturaVoce[] = [];
  const non_capito: string[] = [];
  if (!hits.length) return { letture, non_capito: testo.trim() ? [trascrizione.trim()] : [] };
  hits.forEach((h, i) => {
    const seg = testo.slice(h.fine, i + 1 < hits.length ? hits[i + 1].pos : undefined);
    let trovato = false;
    const nota = seg.match(/\bnota\b[:,]?\s*(.+)$/);
    const corpo = nota ? seg.slice(0, nota.index) : seg;
    // every field keyword with the nearest number after it (or right before it, as in "31 gradi")
    const kw: { campo: CampoVoce; pos: number; fine: number }[] = [];
    for (const [campo, re] of CAMPI_RE)
      for (const m of corpo.matchAll(new RegExp(re.source, "g"))) kw.push({ campo, pos: m.index!, fine: m.index! + m[0].length });
    kw.sort((a, b) => a.pos - b.pos);
    const usati = new Set<CampoVoce>();
    kw.forEach((k, j) => {
      if (usati.has(k.campo)) return;
      const limite = j + 1 < kw.length ? kw[j + 1].pos : corpo.length;
      let m = corpo.slice(k.fine, limite).match(NUMERO);
      let frase = corpo.slice(k.pos, limite).trim();
      if (!m && k.campo === "temp") {
        const prima = corpo.slice(Math.max(0, k.pos - 12), k.pos).match(/(-?\d+(?:,\d+)?)\s*$/);
        if (prima) { m = prima; frase = corpo.slice(Math.max(0, k.pos - 12), k.fine).trim(); }
      }
      if (!m) return;
      let val = Number(m[0].replace(",", "."));
      if (k.campo === "livello_cm") {
        if (/\bmetr[oi]\b/.test(frase) && !/centimetr/.test(frase)) val *= 100;
        else if (/millimetr/.test(frase)) val /= 10;
      }
      usati.add(k.campo);
      trovato = true;
      letture.push({ vasca_id: h.vasca?.id ?? null, vasca_detta: h.detto, campo: k.campo, valore: Math.round(val * 1000) / 1000, testo: frase });
    });
    if (nota) {
      letture.push({ vasca_id: h.vasca?.id ?? null, vasca_detta: h.detto, campo: "note", valore: nota[1].trim(), testo: nota[0] });
      trovato = true;
    }
    if (!trovato && seg.trim()) non_capito.push(`${h.detto} ${seg.trim()}`);
  });
  return { letture, non_capito };
}
