import { biomassa, ficocianina, valutazioneFinale, volumeDaLivello } from "../lib/calc";
import { ultimo, useDerivati } from "../lib/derivati";
import { fmt, fmtDate, fmtDay } from "../lib/format";
import { vai, type Rotta } from "../router";
import { Avvisi, Header, PillStato } from "../components/ui";
import { Grafico, type Punto } from "../components/Grafico";

export function Vasca({ id, tab = "panoramica" }: { id: string; tab?: "panoramica" | "grafici" | "storico" }) {
  const d = useDerivati();
  const v = d.vasche.find((x) => x.id === id);
  if (!v) return <><Header titolo="Vasca" back /><div className="empty">Vasca non trovata.</div></>;
  const lista = d.perVasca.get(id) ?? [];
  const st = d.stati.get(id)!;
  const imp = d.impostazioni;
  const giorni = v.inoculo ? Math.floor((Date.now() - new Date(v.inoculo).getTime()) / 864e5) : null;
  const setTab = (t: "panoramica" | "grafici" | "storico") => vai({ nome: "vasca", id, tab: t } as Rotta, true);

  const ph = ultimo(lista, "ph"), t = ultimo(lista, "temp"), h = ultimo(lista, "livello_cm"), od = ultimo(lista, "od750");
  const b = od && biomassa(od.r, d.m);
  const vol = h ? volumeDaLivello(v, h.v) : null;
  const pcR = [...lista].reverse().find((r) => ficocianina(r.pc)?.resa !== undefined);
  const mic = [...lista].reverse().find((r) => valutazioneFinale(r));

  const serie = (f: (r: (typeof lista)[number]) => number | null | undefined): Punto[] =>
    lista.map((r) => ({ ts: new Date(r.ts).getTime(), v: f(r) })).filter((p): p is Punto => p.v !== null && p.v !== undefined && Number.isFinite(p.v));

  const Valore = ({ lab, val, unita, quando, extra }: { lab: string; val: string; unita?: string; quando?: string; extra?: string }) => (
    <div className="readout"><span className="lab">{lab}</span><span className="val">{val}{unita && <span className="small muted"> {unita}</span>}</span>
      {extra && <span className="estimate">{extra}</span>}{quando && <span className="lab">{fmtDate(quando)}</span>}</div>
  );

  return (
    <>
      <Header titolo={v.nome} back={{ nome: "home" }} azione={<button className="btn sm" onClick={() => vai({ nome: "modificaVasca", id })}>Modifica</button>} />
      <div className="row"><PillStato stato={st.stato} /><span className="muted small">{fmt(v.volume_l, 0)} L{v.ceppo ? ` · ${v.ceppo}` : ""}{v.inoculo ? ` · inoculo ${fmtDay(v.inoculo)}` : ""}{giorni !== null ? ` (giorno ${giorni})` : ""}</span></div>
      <div className="subtabs" role="tablist">
        {(["panoramica", "grafici", "storico"] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>{x[0].toUpperCase() + x.slice(1)}</button>
        ))}
      </div>

      {tab === "panoramica" && (
        <div className="stack">
          {st.avvisi.length ? <Avvisi lista={st.avvisi} /> : lista.length ? <Avvisi lista={[{ livello: "info", titolo: "Nessun avviso", dettaglio: "Gli ultimi valori sono nei range impostati." }]} /> : null}
          <div className="grid2">
            <Valore lab="Biomassa secca" val={b ? fmt(b.gl) : "—"} unita="g/L" quando={od?.r.ts} extra={b?.stima ? "stima, senza calibrazione" : undefined} />
            <Valore lab="Altezza liquido" val={h ? fmt(h.v, 1) : "—"} unita="cm" quando={h?.r.ts} extra={vol !== null ? `≈ ${fmt(vol, 0)} L` : undefined} />
            <Valore lab="pH" val={fmt(ph?.v ?? null, 2)} quando={ph?.r.ts} />
            <Valore lab="Temperatura" val={fmt(t?.v ?? null, 1)} unita="°C" quando={t?.r.ts} />
            <Valore lab="Filamenti spiralati" val={mic ? String(valutazioneFinale(mic)!.spiralati ?? "—") : "—"} unita="%" quando={mic?.ts} />
            <Valore lab="Ficocianina" val={pcR ? fmt(ficocianina(pcR.pc)!.resa!, 0) : "—"} unita="mg/g" quando={pcR?.ts} />
          </div>
          {vol !== null && <p className="formula">Volume = superficie × altezza × 10 = {fmt(v.superficie_m2, 2)} m² × {fmt(h!.v, 1)} cm × 10 = {fmt(vol, 0)} L</p>}
          <div className="grid2">
            <button className="btn primary" onClick={() => vai({ nome: "nuova", vasca: id })}>＋ Rilevazione</button>
            <button className="btn" onClick={() => vai({ nome: "voce" })}>Registra a voce</button>
          </div>
        </div>
      )}

      {tab === "grafici" && (
        <div className="stack">
          <Grafico titolo="Biomassa secca" unita="g/L" dec={2} zero sotto={d.m.tipo === "provvisorio" ? "stima con fattore provvisorio" : `calibrazione, R² ${fmt(d.m.r2, 3)}`}
            punti={serie((r) => biomassa(r, d.m)?.gl)} rif={[{ v: imp.glRaccolta, colore: "--good", etichetta: `raccolta ${fmt(imp.glRaccolta, 1)}` }]} />
          <Grafico titolo="Altezza liquido" unita="cm" sotto={imp.livelloMin !== null || imp.livelloMax !== null ? "con limiti impostati" : "livello in vasca"} punti={serie((r) => r.livello_cm)}
            rif={[{ v: imp.livelloMin, colore: "--warn", etichetta: "min" }, { v: imp.livelloMax, colore: "--warn", etichetta: "max" }]} />
          <Grafico titolo="pH" unita="" sotto={`range ${fmt(imp.phMin, 1)}–${fmt(imp.phMax, 1)}`} punti={serie((r) => r.ph)}
            rif={[{ v: imp.phMin, colore: "--bad", etichetta: "min" }, { v: imp.phMax, colore: "--bad", etichetta: "max" }]} />
          <Grafico titolo="Temperatura" unita="°C" sotto={`range ${fmt(imp.tMin, 0)}–${fmt(imp.tMax, 0)} °C`} punti={serie((r) => r.temp)}
            rif={[{ v: imp.tMin, colore: "--bad", etichetta: "min" }, { v: imp.tMax, colore: "--bad", etichetta: "max" }]} />
          <Grafico titolo="Filamenti ben spiralati" unita="%" dec={0} sotto="valutazione al microscopio" punti={serie((r) => valutazioneFinale(r)?.spiralati)} />
          <Grafico titolo="Ficocianina, resa" unita="mg/g" dec={0} zero sotto="Bennett & Bogorad" punti={serie((r) => ficocianina(r.pc)?.resa)} />
        </div>
      )}

      {tab === "storico" && (
        lista.length ? (
          <div className="list">
            {[...lista].reverse().map((r) => {
              const bb = biomassa(r, d.m), mf = valutazioneFinale(r);
              const parti = [r.livello_cm !== null && `${fmt(r.livello_cm, 0)} cm`, r.ph !== null && `pH ${fmt(r.ph, 2)}`, r.temp !== null && `${fmt(r.temp, 1)} °C`, mf && `${mf.giudizio ?? ""} ${mf.spiralati ?? ""}%`].filter(Boolean);
              return (
                <button key={r.id} onClick={() => vai({ nome: "rilevazione", id: r.id })}>
                  <span><b>{fmtDate(r.ts)}</b>{r.fonte === "voce" && <span className="pill nd" style={{ marginLeft: 6 }}>voce</span>}<br /><span className="muted small mono">{parti.join(" · ") || r.note || "—"}</span></span>
                  <span className="mono">{bb ? fmt(bb.gl) + " g/L" : ""}</span>
                </button>
              );
            })}
          </div>
        ) : <div className="empty">Nessuna rilevazione per questa vasca.</div>
      )}
    </>
  );
}
