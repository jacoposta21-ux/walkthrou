import { useEffect, useRef, useState } from "react";
import { CONTAMINANTI, FILAMENTI, GIUDIZI, LIVELLI, LUNGHEZZE, type Micro, type Valutazione, type ValutazioneAI } from "../lib/types";
import { base64, caricaFoto, riduci, scaricaFoto, urlFoto } from "../lib/immagini";
import { chiediAI } from "../lib/supabase";
import { getStore } from "../lib/store";
import { Lightbox, Seg } from "./ui";

export const valutazioneVuota = (): Valutazione => ({
  spiralati: null, raddrizzati: null, spezzati: null, morti: null, lunghezza: null,
  contaminanti: { altre_alghe: "assente", protozoi: "assente", rotiferi: "assente", batteri: "assente", detriti: "assente" },
  giudizio: null,
});
const essenza = (v: Valutazione | null) => v && JSON.stringify([v.spiralati, v.raddrizzati, v.spezzati, v.morti, v.lunghezza, v.contaminanti, v.giudizio]);
export const corretta = (m: Micro) => !!(m.ai && m.corr && essenza(m.ai) !== essenza(m.corr));
const classeGiudizio = (g: string | null) => (g === "sana" ? "buona" : g === "stressata" ? "attenzione" : g === "contaminata" ? "problema" : "nd");

/** Past AI estimates the grower corrected: sent along so Claude adapts to their judgement. */
function esempiCorrezioni(): string {
  return getStore().rilevazioni.filter((r) => r.micro && corretta(r.micro)).slice(-6)
    .map((r) => `- AI aveva detto ${essenza(r.micro!.ai)}, il coltivatore ha corretto in ${essenza(r.micro!.corr)}`).join("\n");
}

interface Foto { path?: string; blob?: Blob; url: string; caricando?: boolean }

export function Microscopio({ micro, onChange }: { micro: Micro; onChange: (m: Micro) => void }) {
  const [foto, setFoto] = useState<Foto[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [analisi, setAnalisi] = useState(false);
  const [errore, setErrore] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const ref = useRef(micro);
  ref.current = micro;

  useEffect(() => {
    if (!micro.foto.length) return;
    urlFoto(micro.foto).then((u) => setFoto(micro.foto.map((p) => ({ path: p, url: u[p] ?? "" }))));
    // load only once, for an existing reading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aggiungi = async (files: FileList) => {
    for (const f of [...files].slice(0, 5 - foto.length)) {
      const blob = await riduci(f);
      const item: Foto = { blob, url: URL.createObjectURL(blob), caricando: true };
      setFoto((l) => [...l, item]);
      try {
        item.path = await caricaFoto(blob);
        onChange({ ...ref.current, foto: [...ref.current.foto, item.path] });
      } catch {
        setErrore("Una foto non è stata caricata. Riprova.");
      }
      item.caricando = false;
      setFoto((l) => [...l]);
    }
  };
  const togli = (i: number) => {
    const f = foto[i];
    setFoto(foto.filter((_, j) => j !== i));
    if (f.path) onChange({ ...micro, foto: micro.foto.filter((p) => p !== f.path) });
  };

  const analizza = async () => {
    setErrore("");
    setAnalisi(true);
    try {
      const blobs = (await Promise.all(foto.map(async (f) => f.blob ?? (f.path ? await scaricaFoto(f.path) : null)))).filter((b): b is Blob => !!b);
      const immagini = await Promise.all(blobs.map(base64));
      const r = await chiediAI<Omit<ValutazioneAI, "quando">>({ azione: "foto", immagini, ingrandimento: micro.ingrandimento, esempi: esempiCorrezioni() });
      const n5 = (x: number) => Math.max(0, Math.min(100, Math.round(x / 5) * 5));
      const ai: ValutazioneAI = { ...r, spiralati: n5(r.spiralati ?? 0), raddrizzati: n5(r.raddrizzati ?? 0), spezzati: n5(r.spezzati ?? 0), morti: n5(r.morti ?? 0), quando: new Date().toISOString() };
      const { utilizzabile: _u, motivo_inutilizzabile: _m, spiegazione: _s, confidenza: _c, quando: _q, ...corr } = ai;
      onChange({ ...ref.current, ai, corr });
    } catch (e) {
      setErrore((e instanceof Error ? e.message : "Analisi non riuscita.") + " Puoi valutare a mano qui sotto.");
    } finally {
      setAnalisi(false);
    }
  };

  const c = micro.corr ?? valutazioneVuota();
  const ai = micro.ai;
  const cambia = (p: Partial<Valutazione>) => onChange({ ...micro, corr: { ...c, ...p } });
  const somma = FILAMENTI.reduce((s, [k]) => s + (c[k] ?? 0), 0);
  const notaAI = (val: unknown, aiVal: unknown, suf = "") =>
    ai ? <span className={`ai ${val !== aiVal ? "diff" : ""}`}>AI {String(aiVal ?? "—")}{suf}{val !== aiVal ? " → tua correzione" : ""}</span> : null;

  return (
    <div className="stack">
      <Seg valori={["40x", "100x", "400x"] as const} valore={micro.ingrandimento as "100x"} onChange={(v) => onChange({ ...micro, ingrandimento: v })} />
      <div className="thumbs">
        {foto.map((f, i) => (
          <div className="thumb" key={i}>
            {f.url && <img alt={`Foto ${i + 1}`} src={f.url} onClick={() => setZoom(f.url)} />}
            {f.caricando && <span className="spin" style={{ position: "absolute", left: 8, bottom: 8, color: "#fff" }} />}
            <button type="button" className="x" aria-label="Rimuovi foto" onClick={() => togli(i)}>×</button>
          </div>
        ))}
        {foto.length < 5 && (
          <button type="button" className="addphoto" onClick={() => input.current?.click()}><span>＋</span>Foto {foto.length}/5</button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) aggiungi(e.target.files); e.target.value = ""; }} />
      {foto.length > 0 && (analisi
        ? <div className="readout"><span className="row"><span className="spin" /> <b>Claude sta guardando le foto…</b></span><span className="small muted">Di solito 20–60 secondi.</span></div>
        : <button type="button" className="btn wide outline" disabled={foto.some((f) => f.caricando)} onClick={analizza}>{ai ? "Rianalizza le foto con Claude" : "Analizza le foto con Claude"}</button>)}
      {errore && <p className="small" style={{ color: "var(--bad)" }}>{errore}</p>}

      <details className="sec" open={!!(micro.corr || micro.ai)}>
        <summary>Valutazione filamenti {ai && <span className="pill info">AI</span>}</summary>
        <div className="in">
          {ai && (
            <>
              <div className="row"><span className={`pill ${classeGiudizio(ai.giudizio)}`}>AI: {ai.giudizio}</span><span className="small muted">sicura al {ai.confidenza}%</span></div>
              {!ai.utilizzabile && <div className="alert attenzione"><span className="ic">!</span><div><b>Foto poco utilizzabile</b><br /><span>{ai.motivo_inutilizzabile}</span></div></div>}
              {ai.spiegazione && <p className="small">{ai.spiegazione}</p>}
              <p className="small muted">Tocca un valore per correggerlo: salvo sia la stima AI sia la tua.</p>
            </>
          )}
          <div>
            {FILAMENTI.map(([k, n]) => (
              <div className="ev-row" key={k}>
                <span className="lab">{n}{notaAI(c[k], ai?.[k], "%")}</span>
                <span className="stepper">
                  <button type="button" aria-label={`${n} meno 5`} onClick={() => cambia({ [k]: Math.max(0, (c[k] ?? 0) - 5) })}>−</button>
                  <output>{c[k] == null ? "—" : c[k] + "%"}</output>
                  <button type="button" aria-label={`${n} più 5`} onClick={() => cambia({ [k]: Math.min(100, (c[k] ?? 0) + 5) })}>+</button>
                </span>
              </div>
            ))}
          </div>
          <p className={`small ${somma !== 100 && somma > 0 ? "estimate" : "muted"}`}>Somma: {somma}%{somma !== 100 && somma > 0 ? " (dovrebbe fare 100%)" : ""}</p>
          <div>
            <span className="small muted">Lunghezza filamenti{ai ? ` · AI ${ai.lunghezza}` : ""}</span>
            <div style={{ marginTop: 6 }}><Seg valori={LUNGHEZZE} valore={c.lunghezza} onChange={(v) => cambia({ lunghezza: v })} /></div>
          </div>
          <div>
            <span className="small muted">Contaminanti (tocca per cambiare)</span>
            {CONTAMINANTI.map(([k, n]) => (
              <div className="ev-row" key={k}>
                <span className="lab">{n}{notaAI(c.contaminanti[k], ai?.contaminanti?.[k])}</span>
                <button type="button" className={`cyc ${c.contaminanti[k]}`}
                  onClick={() => cambia({ contaminanti: { ...c.contaminanti, [k]: LIVELLI[(LIVELLI.indexOf(c.contaminanti[k]) + 1) % 3] } })}>
                  {c.contaminanti[k]}
                </button>
              </div>
            ))}
          </div>
          <div>
            <span className="small muted">Giudizio{ai ? ` · AI ${ai.giudizio}` : ""}</span>
            <div style={{ marginTop: 6 }}><Seg valori={GIUDIZI} valore={c.giudizio} onChange={(v) => cambia({ giudizio: v })} /></div>
          </div>
        </div>
      </details>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Read-only summary of a microscope evaluation, with the AI's original values next to corrections. */
export function RiepilogoMicro({ micro }: { micro: Micro }) {
  const [url, setUrl] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => { if (micro.foto.length) urlFoto(micro.foto).then(setUrl); }, [micro.foto]);
  const c = micro.corr ?? micro.ai;
  const ai = micro.ai;
  const cella = (v: unknown, a: unknown, suf = "") => (
    <>{String(v ?? "—")}{suf}{ai && micro.corr && v !== a && <span className="small" style={{ color: "var(--accent)" }}> (AI: {String(a ?? "—")}{suf})</span>}</>
  );
  return (
    <div className="stack">
      {micro.foto.length > 0 && (
        <div className="thumbs">{micro.foto.map((p) => <div className="thumb" key={p}>{url[p] && <img alt="Foto al microscopio" src={url[p]} loading="lazy" onClick={() => setZoom(url[p])} />}</div>)}</div>
      )}
      {c && (
        <div className="card stack">
          <div className="row">
            <span className={`pill ${classeGiudizio(c.giudizio)}`}>{c.giudizio ?? "n.d."}</span>
            <span className="muted small">{ai ? `AI sicura al ${ai.confidenza}%${corretta(micro) ? " · corretta da te" : ""}` : "valutazione manuale"}</span>
          </div>
          {ai && !ai.utilizzabile && <div className="alert attenzione"><span className="ic">!</span><div><b>Foto poco utilizzabile</b><br /><span>{ai.motivo_inutilizzabile}</span></div></div>}
          {ai?.spiegazione && <p className="small">{ai.spiegazione}</p>}
          <div className="tbl-wrap"><table><tbody>
            {FILAMENTI.map(([k, n]) => <tr key={k}><td>{n}</td><td className="num">{cella(c[k], ai?.[k], "%")}</td></tr>)}
            <tr><td>Lunghezza</td><td className="num">{cella(c.lunghezza, ai?.lunghezza)}</td></tr>
            {CONTAMINANTI.map(([k, n]) => <tr key={k}><td>{n}</td><td className="num">{cella(c.contaminanti?.[k], ai?.contaminanti?.[k])}</td></tr>)}
          </tbody></table></div>
        </div>
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
