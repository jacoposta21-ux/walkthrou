import { useMemo } from "react";
import { avvisi, modello, type Modello } from "./calc";
import { useStore } from "./store";
import type { Rilevazione } from "./types";

/** Calibration model and readings grouped per tank (oldest first), recomputed when the store changes. */
export function useDerivati() {
  const s = useStore();
  return useMemo(() => {
    const m: Modello = modello(s.calibrazione, s.impostazioni);
    const perVasca = new Map<string, Rilevazione[]>();
    for (const v of s.vasche) perVasca.set(v.id, []);
    for (const r of s.rilevazioni) perVasca.get(r.vasca_id)?.push(r);
    const stati = new Map(s.vasche.map((v) => [v.id, avvisi(perVasca.get(v.id) ?? [], s.impostazioni, m)]));
    return { ...s, m, perVasca, stati };
  }, [s]);
}

/** Most recent non-empty value of a field in a tank's readings. */
export function ultimo<K extends keyof Rilevazione>(lista: Rilevazione[], k: K): { r: Rilevazione; v: NonNullable<Rilevazione[K]> } | null {
  for (let i = lista.length - 1; i >= 0; i--) {
    const v = lista[i][k];
    if (v !== null && v !== undefined) return { r: lista[i], v: v as NonNullable<Rilevazione[K]> };
  }
  return null;
}
