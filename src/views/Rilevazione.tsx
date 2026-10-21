import { biomassa, ficocianina } from "../lib/calc";
import { useDerivati } from "../lib/derivati";
import { eliminaRilevazione } from "../lib/store";
import { fmt, fmtDate } from "../lib/format";
import { vai } from "../router";
import { Header, useUi } from "../components/ui";
import { RiepilogoMicro } from "../components/Microscopio";

export function Rilevazione({ id }: { id: string }) {
  const d = useDerivati();
  const { conferma, toast } = useUi();
  const r = d.rilevazioni.find((x) => x.id === id);
  if (!r) return <><Header titolo="Rilevazione" back /><div className="empty">Rilevazione non trovata.</div></>;
  const v = d.vasche.find((x) => x.id === r.vasca_id);
  const b = biomassa(r, d.m), pc = ficocianina(r.pc);
  const Riga = ({ l, val }: { l: string; val: string }) => <div className="readout"><span className="lab">{l}</span><span className="val">{val}</span></div>;

  return (
    <>
      <Header titolo={fmtDate(r.ts)} back={v ? { nome: "vasca", id: v.id, tab: "storico" } : true} />
      <p className="muted">{v?.nome}{r.fonte === "voce" ? " · registrata a voce" : ""}</p>
      <div className="grid3">
        <Riga l="Altezza" val={r.livello_cm !== null ? `${fmt(r.livello_cm, 1)} cm` : "—"} />
        <Riga l="pH" val={fmt(r.ph, 2)} />
        <Riga l="Temperatura" val={r.temp !== null ? `${fmt(r.temp, 1)} °C` : "—"} />
      </div>
      {b && (<><h3>Densità</h3><div className="readout"><span className="val">{fmt(b.gl)} g/L</span>{b.stima && <span className="estimate">Stima: manca la calibrazione</span>}<span className="formula">{b.formula}</span></div></>)}
      {pc && (
        <><h3>Ficocianina</h3><div className="readout">
          {pc.mgml !== undefined && <><span className="val">{fmt(pc.mgml, 4)} mg/mL</span><span className="formula">{pc.f1}</span></>}
          {pc.resa !== undefined && <><span className="val">{fmt(pc.resa, 1)} mg/g</span><span className="formula">{pc.f2}</span></>}
          {pc.pur !== undefined && <><span className="val">Purezza {fmt(pc.pur, 2)}</span><span className="formula">{pc.f3}</span></>}
        </div></>
      )}
      {r.micro && (<><h3>Microscopio · {r.micro.ingrandimento}</h3><RiepilogoMicro micro={r.micro} /></>)}
      {r.note && (<><h3>Note</h3><p>{r.note}</p></>)}
      {r.trascrizione && (<details className="sec" style={{ marginTop: 12 }}><summary>Cosa hai detto</summary><div className="in"><p className="small">«{r.trascrizione}»</p></div></details>)}
      <div className="grid2" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => vai({ nome: "modifica", id: r.id })}>Modifica</button>
        <button className="btn danger" onClick={() => conferma({
          titolo: "Eliminare la rilevazione?", testo: "Elimino anche le sue foto. Non si può annullare.", ok: "Elimina",
          onOk: async () => { await eliminaRilevazione(r.id); toast("Rilevazione eliminata"); vai({ nome: "vasca", id: r.vasca_id, tab: "storico" }, true); },
        })}>Elimina</button>
      </div>
    </>
  );
}
