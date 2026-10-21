import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { DEFAULTS, type Impostazioni, type PuntoCalibrazione, type Rilevazione, type Vasca } from "./types";

interface Stato {
  pronto: boolean;
  errore: string | null;
  vasche: Vasca[];
  rilevazioni: Rilevazione[];
  calibrazione: PuntoCalibrazione[];
  impostazioni: Impostazioni;
}

let stato: Stato = { pronto: false, errore: null, vasche: [], rilevazioni: [], calibrazione: [], impostazioni: DEFAULTS };
const ascoltatori = new Set<() => void>();
const set = (p: Partial<Stato>) => { stato = { ...stato, ...p }; ascoltatori.forEach((f) => f()); };

export const useStore = () => useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, () => stato);
export const getStore = () => stato;

const NUM_RIL = ["ph", "temp", "livello_cm", "od750", "diluizione"] as const;
const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const normRil = (r: Record<string, unknown>): Rilevazione => {
  const o = { ...r } as unknown as Rilevazione;
  for (const k of NUM_RIL) (o as unknown as Record<string, unknown>)[k] = toNum(r[k]);
  o.diluizione = o.diluizione ?? 1;
  return o;
};
const normVasca = (v: Record<string, unknown>): Vasca => ({ ...(v as unknown as Vasca), volume_l: Number(v.volume_l), superficie_m2: toNum(v.superficie_m2) });

export async function carica() {
  try {
    let { data: vasche, error } = await supabase.from("vasche").select("*").order("numero");
    if (error) throw error;
    if (!vasche?.length) {
      // first login: create the 11 greenhouse tanks
      const r = await supabase.rpc("crea_vasche_iniziali");
      if (r.error) throw r.error;
      ({ data: vasche } = await supabase.from("vasche").select("*").order("numero"));
    }
    const [ril, cal, imp] = await Promise.all([
      supabase.from("rilevazioni").select("*").order("ts"),
      supabase.from("calibrazione").select("id, od, gl").order("od"),
      supabase.from("impostazioni").select("data").maybeSingle(),
    ]);
    if (ril.error) throw ril.error;
    set({
      pronto: true, errore: null,
      vasche: (vasche ?? []).map(normVasca),
      rilevazioni: (ril.data ?? []).map(normRil),
      calibrazione: (cal.data ?? []).map((p) => ({ id: p.id, od: Number(p.od), gl: Number(p.gl) })),
      impostazioni: { ...DEFAULTS, ...((imp.data?.data as Partial<Impostazioni>) ?? {}) },
    });
  } catch (e) {
    set({ pronto: true, errore: e instanceof Error ? e.message : "Errore di caricamento" });
  }
}

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function salvaVasca(v: Partial<Vasca> & { id?: string }) {
  if (v.id) {
    const { id, ...rest } = v;
    const { data, error } = await supabase.from("vasche").update(rest).eq("id", id).select().single();
    fail(error);
    set({ vasche: stato.vasche.map((x) => (x.id === id ? normVasca(data) : x)) });
    return normVasca(data);
  }
  const { data, error } = await supabase.from("vasche").insert(v).select().single();
  fail(error);
  set({ vasche: [...stato.vasche, normVasca(data)].sort((a, b) => a.numero - b.numero) });
  return normVasca(data);
}

export async function eliminaVasca(id: string) {
  fail((await supabase.from("vasche").delete().eq("id", id)).error);
  set({ vasche: stato.vasche.filter((v) => v.id !== id), rilevazioni: stato.rilevazioni.filter((r) => r.vasca_id !== id) });
}

type NuovaRil = Omit<Rilevazione, "id"> & { id?: string };
const ordina = (l: Rilevazione[]) => l.sort((a, b) => a.ts.localeCompare(b.ts));

export async function salvaRilevazioni(righe: NuovaRil[]) {
  const nuove = righe.filter((r) => !r.id);
  const vecchie = righe.filter((r) => r.id);
  const out: Rilevazione[] = [];
  if (nuove.length) {
    const { data, error } = await supabase.from("rilevazioni").insert(nuove).select();
    fail(error);
    out.push(...(data ?? []).map(normRil));
  }
  for (const r of vecchie) {
    const { id, ...rest } = r;
    const { data, error } = await supabase.from("rilevazioni").update(rest).eq("id", id!).select().single();
    fail(error);
    out.push(normRil(data));
  }
  const ids = new Set(out.map((r) => r.id));
  set({ rilevazioni: ordina([...stato.rilevazioni.filter((r) => !ids.has(r.id)), ...out]) });
  return out;
}

export async function eliminaRilevazione(id: string) {
  const r = stato.rilevazioni.find((x) => x.id === id);
  fail((await supabase.from("rilevazioni").delete().eq("id", id)).error);
  if (r?.micro?.foto?.length) await supabase.storage.from("foto").remove(r.micro.foto);
  set({ rilevazioni: stato.rilevazioni.filter((x) => x.id !== id) });
}

export async function aggiungiPunto(od: number, gl: number) {
  const { data, error } = await supabase.from("calibrazione").insert({ od, gl }).select("id, od, gl").single();
  fail(error);
  set({ calibrazione: [...stato.calibrazione, { id: data!.id, od: Number(data!.od), gl: Number(data!.gl) }].sort((a, b) => a.od - b.od) });
}

export async function eliminaPunto(id: string) {
  fail((await supabase.from("calibrazione").delete().eq("id", id)).error);
  set({ calibrazione: stato.calibrazione.filter((p) => p.id !== id) });
}

export async function salvaImpostazioni(imp: Impostazioni) {
  const { data: u } = await supabase.auth.getUser();
  fail((await supabase.from("impostazioni").upsert({ owner: u.user!.id, data: imp, updated_at: new Date().toISOString() })).error);
  set({ impostazioni: imp });
}

export function svuota() {
  set({ pronto: false, errore: null, vasche: [], rilevazioni: [], calibrazione: [], impostazioni: DEFAULTS });
}
