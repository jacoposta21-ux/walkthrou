import { biomassa, ficocianina, volumeDaLivello, type Modello } from "./calc";
import { CONTAMINANTI, FILAMENTI, type Rilevazione, type Valutazione, type Vasca } from "./types";
import { localInput } from "./format";

/** Semicolon-separated, decimal comma, BOM: opens directly in Italian Excel. */
export function creaCsv(ril: Rilevazione[], vasche: Vasca[], m: Modello): string {
  const ev = (p: string) => [...FILAMENTI.map(([k]) => `${p}_${k}_pct`), `${p}_lunghezza`, ...CONTAMINANTI.map(([k]) => `${p}_${k}`), `${p}_giudizio`];
  const cols = ["id", "vasca_numero", "vasca", "data_ora", "fonte", "pH", "temperatura_C", "altezza_liquido_cm", "volume_stimato_L", "OD750", "diluizione", "OD750_effettiva", "biomassa_g_L", "metodo_biomassa",
    "lambda_PC_nm", "A_PC", "A652", "A280", "tampone_mL", "biomassa_estratta_mg", "PC_mg_mL", "PC_resa_mg_g", "purezza", "ingrandimento", "n_foto",
    ...ev("ai"), ...ev("tuo"), "ai_confidenza_pct", "ai_utilizzabile", "ai_spiegazione", "note", "trascrizione"];
  const d = (v: unknown) => (v === null || v === undefined || v === "" ? "" : typeof v === "number" ? String(+v.toFixed(6)).replace(".", ",") : String(v));
  const q = (v: unknown) => { const s = d(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const valori = (e: Valutazione | null | undefined) => e ? [...FILAMENTI.map(([k]) => e[k]), e.lunghezza, ...CONTAMINANTI.map(([k]) => e.contaminanti?.[k]), e.giudizio] : Array(FILAMENTI.length + CONTAMINANTI.length + 2).fill("");
  const metodo = m.tipo === "calibrazione" ? `calibrazione a=${d(m.a)} b=${d(m.b)} R2=${d(m.r2)}` : `provvisorio k=${d(m.k)}`;
  const byId = new Map(vasche.map((v) => [v.id, v]));
  const righe = [...ril].sort((a, b) => a.ts.localeCompare(b.ts)).map((r) => {
    const v = byId.get(r.vasca_id);
    const b = biomassa(r, m), p = ficocianina(r.pc), ai = r.micro?.ai, co = r.micro?.corr;
    return [r.id, v?.numero, v?.nome, localInput(r.ts).replace("T", " "), r.fonte, r.ph, r.temp, r.livello_cm, v ? volumeDaLivello(v, r.livello_cm) : null,
      r.od750, r.od750 !== null ? r.diluizione : null, b?.odEff, b?.gl, b ? metodo : "",
      r.pc?.lambda, r.pc?.aPC, r.pc?.a652, r.pc?.a280, r.pc?.vol, r.pc?.massa, p?.mgml, p?.resa, p?.pur, r.micro?.ingrandimento, r.micro?.foto?.length ?? 0,
      ...valori(ai), ...valori(co), ai?.confidenza, ai ? (ai.utilizzabile ? "si" : "no") : "", ai?.spiegazione, r.note, r.trascrizione].map(q).join(";");
  });
  return "﻿" + cols.join(";") + "\r\n" + righe.join("\r\n");
}

export function scarica(nome: string, testo: string) {
  const url = URL.createObjectURL(new Blob([testo], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
