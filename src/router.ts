import { useEffect, useState } from "react";

// Hash routes, so the phone's back button works and any page can be bookmarked.
export type Rotta =
  | { nome: "home" }
  | { nome: "voce" }
  | { nome: "vasca"; id: string; tab?: "panoramica" | "grafici" | "storico" }
  | { nome: "modificaVasca"; id?: string }
  | { nome: "nuova"; vasca?: string }
  | { nome: "modifica"; id: string }
  | { nome: "rilevazione"; id: string }
  | { nome: "calibrazione" }
  | { nome: "impostazioni" };

export function leggi(hash = location.hash): Rotta {
  const [a, b, c] = hash.replace(/^#\/?/, "").split("/");
  switch (a) {
    case "voce": return { nome: "voce" };
    case "vasca": return b ? { nome: "vasca", id: b, tab: (c as "grafici") || "panoramica" } : { nome: "home" };
    case "vasca-modifica": return { nome: "modificaVasca", id: b || undefined };
    case "nuova": return { nome: "nuova", vasca: b || undefined };
    case "modifica": return b ? { nome: "modifica", id: b } : { nome: "home" };
    case "rilevazione": return b ? { nome: "rilevazione", id: b } : { nome: "home" };
    case "calibrazione": return { nome: "calibrazione" };
    case "impostazioni": return { nome: "impostazioni" };
    default: return { nome: "home" };
  }
}

export function href(r: Rotta): string {
  switch (r.nome) {
    case "home": return "#/";
    case "vasca": return `#/vasca/${r.id}${r.tab && r.tab !== "panoramica" ? "/" + r.tab : ""}`;
    case "modificaVasca": return `#/vasca-modifica${r.id ? "/" + r.id : ""}`;
    case "nuova": return `#/nuova${r.vasca ? "/" + r.vasca : ""}`;
    case "modifica": return `#/modifica/${r.id}`;
    case "rilevazione": return `#/rilevazione/${r.id}`;
    default: return `#/${r.nome}`;
  }
}

export const vai = (r: Rotta, sostituisci = false) => {
  if (sostituisci) history.replaceState(null, "", href(r)); else history.pushState(null, "", href(r));
  window.dispatchEvent(new HashChangeEvent("hashchange"));
};
export const indietro = (fallback: Rotta = { nome: "home" }) => (history.length > 1 ? history.back() : vai(fallback, true));

export function useRotta() {
  const [r, setR] = useState(leggi);
  useEffect(() => {
    const f = () => { setR(leggi()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    window.addEventListener("popstate", f);
    return () => { window.removeEventListener("hashchange", f); window.removeEventListener("popstate", f); };
  }, []);
  return r;
}
