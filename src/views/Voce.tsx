import { useState } from "react";
import { CAMPI_VOCE, interpretaLocale, type CampoVoce, type LetturaVoce } from "../lib/voce";
import { chiediAI } from "../lib/supabase";
import { salvaRilevazioni, useStore } from "../lib/store";
import { num, fmt, localInput } from "../lib/format";
import { parlatoDisponibile, useDettatura } from "../lib/parlato";
import type { Rilevazione } from "../lib/types";
import { vai } from "../router";
import { Header, IcoMic, useUi } from "../components/ui";

interface Riga { k: number; vasca_id: string | null; vasca_detta: string; campo: CampoVoce; valore: string; testo: string }
const ORDINE: CampoVoce[] = ["livello_cm", "ph", "temp", "od750", "diluizione", "note"];
// sanity ranges: values outside are shown in warning colour (likely a misheard number)
const PLAUSIBILE: Partial<Record<CampoVoce, [number, number]>> = { ph: [6, 13], temp: [0, 50], livello_cm: [1, 200], od750: [0, 4], diluizione: [1, 100] };

export function Voce() {
  const { vasche } = useStore();
  const { toast } = useUi();
  const det = useDettatura();
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [nonCapito, setNonCapito] = useState<string[]>([]);
  const [modo, setModo] = useState<"ai" | "locale" | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [quando, setQuando] = useState(() => localInput(Date.now()));
  const testo = det.testo + (det.provvisorio ? " " + det.provvisorio : "");

  const interpreta = async () => {
    det.ferma();
    const t = det.testo.trim();
    if (!t) return toast("Prima detta o scrivi le misure.");
    setLavoro(true);
    let ris: { letture: LetturaVoce[]; non_capito: string[] };
    try {
      ris = await chiediAI({ azione: "voce", trascrizione: t, vasche: vasche.map((v) => ({ id: v.id, numero: v.numero, nome: v.nome, alias: v.alias })) });
      setModo("ai");
    } catch {
      ris = interpretaLocale(t, vasche);
      setModo("locale");
    }
    const ids = new Set(vasche.map((v) => v.id));
    setRighe(ris.letture.map((l, i) => ({
      k: i, vasca_id: l.vasca_id && ids.has(l.vasca_id) ? l.vasca_id : null, vasca_detta: l.vasca_detta, campo: l.campo,
      valore: typeof l.valore === "number" ? String(l.valore).replace(".", ",") : String(l.valore), testo: l.testo,
    })));
    setNonCapito(ris.non_capito);
    setQuando(localInput(Date.now()));
    setLavoro(false);
  };

  const cambia = (k: number, p: Partial<Riga>) => setRighe((rs) => rs!.map((r) => (r.k === k ? { ...r, ...p } : r)));
  const togli = (k: number) => setRighe((rs) => rs!.filter((r) => r.k !== k));

  const salva = async () => {
    if (!righe) return;
    const valide = righe.filter((r) => r.vasca_id && (r.campo === "note" ? r.valore.trim() : num(r.valore) !== null));
    if (righe.some((r) => !r.vasca_id)) return toast("Assegna una vasca alle misure senza vasca, o toglile.");
    if (!valide.length) return toast("Nessuna misura da salvare.");
    const ts = new Date(quando).toISOString();
    const perVasca = new Map<string, Omit<Rilevazione, "id">>();
    for (const r of valide) {
      const ril = perVasca.get(r.vasca_id!) ?? {
        vasca_id: r.vasca_id!, ts, ph: null, temp: null, livello_cm: null, od750: null, diluizione: 1, pc: null, micro: null,
        note: "", fonte: "voce" as const, trascrizione: det.testo.trim(),
      };
      if (r.campo === "note") ril.note = [ril.note, r.valore.trim()].filter(Boolean).join(" · ");
      else (ril as unknown as Record<string, number | null>)[r.campo] = num(r.valore);
      perVasca.set(r.vasca_id!, ril);
    }
    setLavoro(true);
    try {
      await salvaRilevazioni([...perVasca.values()]);
      toast(`Salvate ${perVasca.size} rilevazioni`);
      det.azzera();
      setRighe(null);
      vai({ nome: "home" }, true);
    } catch (e) {
      toast("Salvataggio non riuscito: " + (e instanceof Error ? e.message : ""));
    } finally {
      setLavoro(false);
    }
  };

  if (righe) {
    const gruppi = new Map<string | null, Riga[]>();
    for (const r of [...righe].sort((a, b) => ORDINE.indexOf(a.campo) - ORDINE.indexOf(b.campo))) gruppi.set(r.vasca_id, [...(gruppi.get(r.vasca_id) ?? []), r]);
    const ordinate = [...gruppi.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : vasche.find((v) => v.id === a)!.numero - vasche.find((v) => v.id === b)!.numero));
    return (
      <>
        <Header titolo="Controlla e salva" back />
        <p className="muted small">
          {modo === "ai" ? "Claude ha interpretato quello che hai detto." : "Interpretazione semplice: l'AI non è disponibile, controlla bene."} Correggi un valore toccandolo, togli quello che non serve.
        </p>
        <label className="f" htmlFor="v-quando">Data e ora<input id="v-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></label>
        <div className="stack" style={{ marginTop: 12 }}>
          {ordinate.map(([vid, rs]) => {
            const v = vasche.find((x) => x.id === vid);
            return (
              <div className="vgroup" key={vid ?? "nessuna"}>
                <div className="hd">
                  {v ? <span>{v.nome}</span> : <span style={{ color: "var(--bad)" }}>Vasca non riconosciuta</span>}
                  <span className="muted small">{rs.length} {rs.length === 1 ? "misura" : "misure"}</span>
                </div>
                {rs.map((r) => {
                  const info = CAMPI_VOCE[r.campo];
                  const n = num(r.valore);
                  const lim = PLAUSIBILE[r.campo];
                  const strano = lim && n !== null && (n < lim[0] || n > lim[1]);
                  return (
                    <div key={r.k}>
                      {!v && (
                        <div style={{ padding: "8px 14px 0" }}>
                          <select className="sm" aria-label="Scegli la vasca" value="" onChange={(e) => cambia(r.k, { vasca_id: e.target.value })}>
                            <option value="" disabled>Detto «{r.vasca_detta}»: scegli la vasca…</option>
                            {vasche.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                          </select>
                        </div>
                      )}
                      <div className={`vline ${r.campo === "note" ? "nota" : ""}`}>
                        {r.campo === "note" ? (
                          <label className="f">{info.nome}<input className="sm" value={r.valore} onChange={(e) => cambia(r.k, { valore: e.target.value })} /></label>
                        ) : (
                          <>
                            <span><b>{info.nome}</b> {info.unita && <span className="muted mono small">{info.unita}</span>}<br /><span className="q">«{r.testo}»</span></span>
                            <input className="sm mono" inputMode="decimal" aria-label={info.nome} value={r.valore} style={strano ? { borderColor: "var(--warn)", color: "var(--warn)" } : undefined} onChange={(e) => cambia(r.k, { valore: e.target.value })} />
                          </>
                        )}
                        <button className="x" aria-label="Togli" onClick={() => togli(r.k)}>×</button>
                      </div>
                      {strano && <p className="small estimate" style={{ padding: "0 14px 8px", margin: 0 }}>Valore insolito ({fmt(lim![0], 0)}–{fmt(lim![1], 0)} atteso): controlla.</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!righe.length && <div className="empty">Non ho trovato misure. Prova a dire per esempio «vasca 2 pH 10,3».</div>}
          {nonCapito.length > 0 && (
            <div className="alert attenzione"><span className="ic">?</span><div><b>Non ho capito</b><br /><span>{nonCapito.map((t, i) => <span key={i}>«{t}»<br /></span>)}</span></div></div>
          )}
        </div>
        <div className="savebar stack">
          <button className="btn primary wide" style={{ minHeight: 62, fontSize: "1.1rem" }} disabled={lavoro || !righe.length} onClick={salva}>
            {lavoro ? <span className="spin" /> : `Salva ${new Set(righe.filter((r) => r.vasca_id).map((r) => r.vasca_id)).size} vasche`}
          </button>
          <button className="btn wide" onClick={() => setRighe(null)}>Torna alla dettatura</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header titolo="Registra dati" back />
      <p className="muted">Tocca il microfono e detta tutte le misure di fila, vasca per vasca. Quando hai finito tocca <b>Interpreta</b>.</p>
      <button className={`mic ${det.attivo ? "on" : ""}`} aria-label={det.attivo ? "Ferma registrazione" : "Inizia a registrare"} onClick={det.attivo ? det.ferma : det.avvia}>
        {det.attivo ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <IcoMic />}
      </button>
      <p className="muted small" style={{ textAlign: "center" }}>{det.attivo ? "Sto ascoltando… tocca per fermare" : parlatoDisponibile() ? "Tocca per parlare" : "Dettatura non disponibile qui: scrivi nel riquadro"}</p>
      {det.errore && <div className="banner">{det.errore}</div>}
      <label className="f" htmlFor="v-testo" style={{ marginTop: 8 }}>Testo
        <textarea id="v-testo" className="transcript" value={testo} placeholder="Vasca 1 altezza 23 centimetri. Vasca 2 altezza 21. Vasca 3 pH 10,4, temperatura 31 gradi, nota schiuma in superficie."
          onChange={(e) => det.setTesto(e.target.value)} readOnly={det.attivo} />
      </label>
      <div className="savebar stack">
        <button className="btn primary wide" style={{ minHeight: 62, fontSize: "1.1rem" }} disabled={lavoro || !det.testo.trim()} onClick={interpreta}>
          {lavoro ? <><span className="spin" /> Interpreto…</> : "Interpreta"}
        </button>
        {det.testo && !det.attivo && <button className="btn wide" onClick={det.azzera}>Cancella testo</button>}
      </div>
      <details className="sec" style={{ marginTop: 12 }}>
        <summary>Cosa posso dire</summary>
        <div className="in small">
          <p>Nomina la vasca e poi le misure: <b>«vasca 4, altezza 22 centimetri, pH 10 virgola 6, temperatura 30 gradi»</b>. Poi passa alla vasca successiva.</p>
          <p>Misure riconosciute: altezza o livello del liquido (cm, anche in metri), pH, temperatura (°C), OD o assorbanza a 750, diluizione, e <b>«nota …»</b> per un'osservazione.</p>
          <p>Puoi chiamare le vasche per numero o col nome che hai dato in Impostazioni.</p>
        </div>
      </details>
    </>
  );
}
