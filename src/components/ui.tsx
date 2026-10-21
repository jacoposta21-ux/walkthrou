import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Avviso, Stato } from "../lib/calc";
import { STATO_TESTO } from "../lib/calc";
import { indietro, type Rotta } from "../router";

export function Header({ titolo, back, azione }: { titolo: string; back?: Rotta | true; azione?: ReactNode }) {
  return (
    <header className="top">
      {back && <button className="back" aria-label="Indietro" onClick={() => indietro(back === true ? undefined : back)}>←</button>}
      <h1>{titolo}</h1>
      {azione}
    </header>
  );
}

export const PillStato = ({ stato }: { stato: Stato }) => <span className={`pill ${stato}`}>{STATO_TESTO[stato]}</span>;

export function Avvisi({ lista }: { lista: Avviso[] }) {
  return (
    <div className="stack">
      {lista.map((a, i) => (
        <div key={i} className={`alert ${a.livello}`} role={a.livello === "problema" ? "alert" : undefined}>
          <span className="ic">{a.livello === "info" ? "✓" : "!"}</span>
          <div><b>{a.titolo}</b><br /><span>{a.dettaglio}</span></div>
        </div>
      ))}
    </div>
  );
}

export function Seg<T extends string>({ valori, valore, onChange, etichetta }: { valori: readonly T[]; valore: T | null; onChange: (v: T) => void; etichetta?: (v: T) => string }) {
  return (
    <div className="seg">
      {valori.map((v) => (
        <button type="button" key={v} aria-pressed={valore === v} onClick={() => onChange(v)}>{etichetta ? etichetta(v) : v}</button>
      ))}
    </div>
  );
}

/** Numeric text input that accepts the Italian decimal comma. */
export function CampoNum({ id, label, unita, value, onChange, placeholder }: { id: string; label: string; unita?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="f" htmlFor={id}>
      <span>{label} {unita && <span className="u">{unita}</span>}</span>
      <input id={id} className="numin" inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* toast + confirmation sheet */
interface Conferma { titolo: string; testo: string; ok: string; onOk: () => void | Promise<void> }
const Ctx = createContext<{ toast: (m: string) => void; conferma: (c: Conferma) => void }>({ toast: () => {}, conferma: () => {} });
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [c, setC] = useState<Conferma | null>(null);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg((x) => (x === m ? null : x)), 2600); }, []);
  return (
    <Ctx.Provider value={{ toast, conferma: setC }}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
      {c && (
        <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && setC(null)}>
          <div className="sheet" role="dialog" aria-modal="true">
            <h2 style={{ margin: 0 }}>{c.titolo}</h2>
            <p className="muted">{c.testo}</p>
            <div className="grid2">
              <button className="btn" onClick={() => setC(null)}>Annulla</button>
              <button className="btn danger" autoFocus onClick={async () => { setC(null); await c.onOk(); }}>{c.ok}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return <div className="lightbox" onClick={onClose}><img alt="Foto al microscopio" src={src} /></div>;
}

export const IcoMic = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Zm7-4a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11Z" /></svg>
);
