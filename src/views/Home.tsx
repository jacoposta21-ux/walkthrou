import { biomassa } from "../lib/calc";
import { creaCsv, scarica } from "../lib/csv";
import { ultimo, useDerivati } from "../lib/derivati";
import { fmt, fmtDate } from "../lib/format";
import { vai } from "../router";
import { Header, IcoMic, PillStato } from "../components/ui";

export function Home() {
  const d = useDerivati();
  const conta = { problema: 0, attenzione: 0, buona: 0, nd: 0 };
  d.vasche.forEach((v) => conta[d.stati.get(v.id)!.stato]++);
  const allarmi = d.vasche.flatMap((v) => d.stati.get(v.id)!.avvisi.filter((a) => a.livello !== "info").map((a) => ({ v, a })));

  return (
    <>
      <Header titolo="Quaderno di Vasca" />
      <button className="recbig" onClick={() => vai({ nome: "voce" })}>
        <span className="dot"><IcoMic /></span>
        <span>Registra dati a voce<br /><span className="small" style={{ fontFamily: "var(--f-body)", fontWeight: 500, opacity: 0.85 }}>«Vasca 1 altezza 23, vasca 3 pH 10,4…»</span></span>
      </button>
      <div className="grid2" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => vai({ nome: "nuova" })}>＋ Rilevazione completa</button>
        <button className="btn" onClick={() => scarica(`quaderno-di-vasca-${new Date().toISOString().slice(0, 10)}.csv`, creaCsv(d.rilevazioni, d.vasche, d.m))}>Esporta CSV</button>
      </div>

      <h2>Vasche <span className="muted small" style={{ fontFamily: "var(--f-body)", fontWeight: 400 }}>· {conta.problema} problemi · {conta.attenzione} da tenere d'occhio · {conta.buona} buone{conta.nd ? ` · ${conta.nd} senza dati` : ""}</span></h2>
      {allarmi.length > 0 && (
        <div className="stack" style={{ marginBottom: 12 }}>
          {allarmi.slice(0, 4).map(({ v, a }, i) => (
            <button key={i} className={`alert ${a.livello}`} style={{ border: 0, textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => vai({ nome: "vasca", id: v.id })}>
              <span className="ic">!</span><div><b>{v.nome}: {a.titolo}</b><br /><span>{a.dettaglio}</span></div>
            </button>
          ))}
          {allarmi.length > 4 && <p className="small muted">e altri {allarmi.length - 4} avvisi nelle singole vasche.</p>}
        </div>
      )}
      <div className="tanks">
        {d.vasche.filter((v) => v.attiva).map((v) => {
          const lista = d.perVasca.get(v.id) ?? [];
          const st = d.stati.get(v.id)!;
          const od = ultimo(lista, "od750");
          const b = od && biomassa(od.r, d.m);
          const ph = ultimo(lista, "ph"), t = ultimo(lista, "temp"), h = ultimo(lista, "livello_cm");
          return (
            <button className="tank" key={v.id} onClick={() => vai({ nome: "vasca", id: v.id })}>
              <span className={`stripe ${st.stato}`} />
              <span className="in">
                <span className="name"><span>{v.nome}</span><span className="muted small mono">{fmt(v.volume_l / 1000, 0)} m³</span></span>
                <PillStato stato={st.stato} />
                <span className="vals">
                  <span>g/L</span><span>{b ? fmt(b.gl) : "—"}{b?.stima ? "*" : ""}</span>
                  <span>pH</span><span>{fmt(ph?.v ?? null, 1)}</span>
                  <span>°C</span><span>{fmt(t?.v ?? null, 1)}</span>
                  <span>Altezza</span><span>{h ? fmt(h.v, 0) + " cm" : "—"}</span>
                </span>
                <span className="muted small">{st.ultima ? fmtDate(st.ultima.ts) : "Nessuna rilevazione"}</span>
              </span>
            </button>
          );
        })}
      </div>
      {d.m.tipo === "provvisorio" && <p className="small muted" style={{ marginTop: 10 }}>* g/L stimati con il fattore provvisorio: aggiungi i punti in Calibrazione.</p>}
    </>
  );
}
