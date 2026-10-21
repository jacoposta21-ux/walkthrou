import { CONTAMINANTI, type Impostazioni, type Ficocianina, type PuntoCalibrazione, type Rilevazione, type Valutazione, type Vasca } from "./types";
import { fmt } from "./format";

export interface Retta { tipo: "calibrazione"; a: number; b: number; r2: number; n: number }
export interface Provvisorio { tipo: "provvisorio"; k: number }
export type Modello = Retta | Provvisorio;

/** Least-squares line gl = a·od + b with coefficient of determination. */
export function regressione(p: { od: number; gl: number }[]): Omit<Retta, "tipo"> | null {
  const n = p.length;
  if (n < 2) return null;
  const mx = p.reduce((s, q) => s + q.od, 0) / n;
  const my = p.reduce((s, q) => s + q.gl, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const q of p) {
    sxx += (q.od - mx) ** 2;
    sxy += (q.od - mx) * (q.gl - my);
    syy += (q.gl - my) ** 2;
  }
  if (sxx === 0) return null;
  const a = sxy / sxx;
  return { a, b: my - a * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy), n };
}

export function modello(punti: PuntoCalibrazione[], imp: Impostazioni): Modello {
  const reg = regressione(punti);
  return reg ? { tipo: "calibrazione", ...reg } : { tipo: "provvisorio", k: imp.kProvv };
}

export interface Biomassa { odEff: number; gl: number; stima: boolean; formula: string }

export function biomassa(r: Pick<Rilevazione, "od750" | "diluizione">, m: Modello): Biomassa | null {
  if (r.od750 === null || r.od750 === undefined) return null;
  const dil = r.diluizione || 1;
  const odEff = r.od750 * dil;
  if (m.tipo === "calibrazione") {
    const gl = m.a * odEff + m.b;
    return {
      odEff, gl, stima: false,
      formula: `OD_eff = ${fmt(r.od750, 3)} × ${fmt(dil, 0)} = ${fmt(odEff, 3)} · g/L = ${fmt(m.a, 4)} × OD_eff ${m.b < 0 ? "−" : "+"} ${fmt(Math.abs(m.b), 4)} (R² ${fmt(m.r2, 3)})`,
    };
  }
  return {
    odEff, gl: m.k * odEff, stima: true,
    formula: `OD_eff = ${fmt(r.od750, 3)} × ${fmt(dil, 0)} = ${fmt(odEff, 3)} · g/L = ${fmt(m.k, 3)} × OD_eff (fattore provvisorio)`,
  };
}

export interface RisultatoPC { mgml?: number; resa?: number; pur?: number; f1?: string; f2?: string; f3?: string }

/** Bennett & Bogorad (1973): PC (mg/mL) = (A620 − 0.474·A652) / 5.34. */
export function ficocianina(pc: Ficocianina | null): RisultatoPC | null {
  if (!pc) return null;
  const { aPC: A, a652, a280, vol: V, massa: m, lambda: L } = pc;
  const out: RisultatoPC = {};
  if (A !== null && a652 !== null) {
    out.mgml = (A - 0.474 * a652) / 5.34;
    out.f1 = `PC = (A${L} − 0,474 × A652) / 5,34 = (${fmt(A, 3)} − 0,474 × ${fmt(a652, 3)}) / 5,34 = ${fmt(out.mgml, 4)} mg/mL`;
    if (V !== null && m !== null && m > 0) {
      out.resa = (out.mgml * V) / (m / 1000);
      out.f2 = `Resa = PC × V / m = ${fmt(out.mgml, 4)} mg/mL × ${fmt(V, 1)} mL / ${fmt(m / 1000, 4)} g = ${fmt(out.resa, 1)} mg/g`;
    }
  }
  if (A !== null && a280 !== null && a280 > 0) {
    out.pur = A / a280;
    out.f3 = `Purezza = A${L} / A280 = ${fmt(A, 3)} / ${fmt(a280, 3)} = ${fmt(out.pur, 2)}`;
  }
  return out.mgml !== undefined || out.pur !== undefined ? out : null;
}

/** Culture volume from liquid level, when the tank's surface is known: L = m² × cm × 10. */
export const volumeDaLivello = (v: Vasca, livello: number | null) =>
  v.superficie_m2 && livello !== null ? v.superficie_m2 * livello * 10 : null;

export const valutazioneFinale = (r: Rilevazione): Valutazione | null => (r.micro ? r.micro.corr ?? r.micro.ai : null);

export type Stato = "buona" | "attenzione" | "problema" | "nd";
export interface Avviso { livello: "info" | "attenzione" | "problema"; titolo: string; dettaglio: string }

export const STATO_TESTO: Record<Stato, string> = {
  buona: "Buona",
  attenzione: "Da tenere d'occhio",
  problema: "Problema",
  nd: "Nessun dato",
};

/** Alerts and overall status of one tank, from its readings sorted oldest first. */
export function avvisi(lista: Rilevazione[], imp: Impostazioni, m: Modello): { stato: Stato; avvisi: Avviso[]; ultima: Rilevazione | null } {
  const ultima = lista[lista.length - 1] ?? null;
  const out: Avviso[] = [];
  if (!ultima) return { stato: "nd", avvisi: out, ultima };
  // Each value comes from the most recent reading that has it: voice entries often carry one field only.
  const ultimoCon = <K extends keyof Rilevazione>(k: K) => [...lista].reverse().find((r) => r[k] !== null && r[k] !== undefined) ?? null;

  const rOd = ultimoCon("od750");
  const b = rOd && biomassa(rOd, m);
  if (b && b.gl >= imp.glRaccolta)
    out.push({ livello: "info", titolo: "Pronta per la raccolta", dettaglio: `Densità ${fmt(b.gl)} g/L ≥ soglia ${fmt(imp.glRaccolta)} g/L${b.stima ? " (stima con fattore provvisorio)" : ""}.` });

  const rPh = ultimoCon("ph");
  if (rPh && rPh.ph !== null && (rPh.ph < imp.phMin || rPh.ph > imp.phMax))
    out.push({ livello: "problema", titolo: "pH fuori range", dettaglio: `pH ${fmt(rPh.ph, 2)}, range ${fmt(imp.phMin, 1)}–${fmt(imp.phMax, 1)}.` });

  const rT = ultimoCon("temp");
  if (rT && rT.temp !== null && (rT.temp < imp.tMin || rT.temp > imp.tMax))
    out.push({ livello: "problema", titolo: "Temperatura fuori range", dettaglio: `${fmt(rT.temp, 1)} °C, range ${fmt(imp.tMin, 0)}–${fmt(imp.tMax, 0)} °C.` });

  const rL = ultimoCon("livello_cm");
  if (rL && rL.livello_cm !== null) {
    if (imp.livelloMin !== null && rL.livello_cm < imp.livelloMin)
      out.push({ livello: "attenzione", titolo: "Livello basso", dettaglio: `${fmt(rL.livello_cm, 1)} cm, minimo ${fmt(imp.livelloMin, 0)} cm: serve un rabbocco.` });
    if (imp.livelloMax !== null && rL.livello_cm > imp.livelloMax)
      out.push({ livello: "attenzione", titolo: "Livello alto", dettaglio: `${fmt(rL.livello_cm, 1)} cm, massimo ${fmt(imp.livelloMax, 0)} cm.` });
  }

  const conMicro = lista.filter((r) => valutazioneFinale(r)?.raddrizzati != null);
  if (conMicro.length >= 3) {
    const t = conMicro.slice(-3).map((r) => valutazioneFinale(r)!.raddrizzati!);
    if (t[0] < t[1] && t[1] < t[2])
      out.push({ livello: "attenzione", titolo: "Filamenti raddrizzati in aumento", dettaglio: `Ultime 3 osservazioni: ${t.join("% → ")}%. Possibile stress (luce, pH, nutrienti).` });
  }

  const rM = [...lista].reverse().find((r) => valutazioneFinale(r));
  const mv = rM && valutazioneFinale(rM);
  if (mv) {
    const trovati = CONTAMINANTI.filter(([k]) => mv.contaminanti?.[k] && mv.contaminanti[k] !== "assente");
    const grave = trovati.some(([k]) => mv.contaminanti[k] === "molto" && k !== "detriti");
    if (trovati.length || mv.giudizio === "contaminata")
      out.push({
        livello: grave || mv.giudizio === "contaminata" ? "problema" : "attenzione",
        titolo: "Contaminazione",
        dettaglio: trovati.length ? trovati.map(([k, n]) => `${n}: ${mv.contaminanti[k]}`).join(" · ") : "Giudizio al microscopio: contaminata.",
      });
    else if (mv.giudizio === "stressata")
      out.push({ livello: "attenzione", titolo: "Coltura stressata", dettaglio: "Giudizio al microscopio: stressata." });
  }

  const stato: Stato = out.some((a) => a.livello === "problema") ? "problema" : out.some((a) => a.livello === "attenzione") ? "attenzione" : "buona";
  return { stato, avvisi: out, ultima };
}
