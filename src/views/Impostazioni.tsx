import { useState } from "react";
import { useDerivati } from "../lib/derivati";
import { salvaImpostazioni } from "../lib/store";
import { supabase } from "../lib/supabase";
import { creaCsv, scarica } from "../lib/csv";
import { fmt, inputStr, num } from "../lib/format";
import { DEFAULTS, type Impostazioni as Imp } from "../lib/types";
import { vai } from "../router";
import { CampoNum, Header, Seg, useUi } from "../components/ui";

export function Impostazioni() {
  const d = useDerivati();
  const { toast } = useUi();
  const s = d.impostazioni;
  const [f, setF] = useState({
    gl: inputStr(s.glRaccolta), phMin: inputStr(s.phMin), phMax: inputStr(s.phMax), tMin: inputStr(s.tMin), tMax: inputStr(s.tMax),
    livMin: inputStr(s.livelloMin), livMax: inputStr(s.livelloMax), k: inputStr(s.kProvv),
  });
  const [lambda, setLambda] = useState(s.lambdaPC);
  const [ingr, setIngr] = useState(s.ingrandimento);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const salva = async () => {
    const imp: Imp = {
      glRaccolta: num(f.gl) ?? DEFAULTS.glRaccolta, phMin: num(f.phMin) ?? DEFAULTS.phMin, phMax: num(f.phMax) ?? DEFAULTS.phMax,
      tMin: num(f.tMin) ?? DEFAULTS.tMin, tMax: num(f.tMax) ?? DEFAULTS.tMax, livelloMin: num(f.livMin), livelloMax: num(f.livMax),
      kProvv: num(f.k) ?? DEFAULTS.kProvv, lambdaPC: lambda, ingrandimento: ingr,
    };
    try { await salvaImpostazioni(imp); toast("Impostazioni salvate"); } catch { toast("Salvataggio non riuscito"); }
  };

  return (
    <>
      <Header titolo="Impostazioni" />
      <h3 style={{ marginTop: 0 }}>Vasche</h3>
      <div className="list">
        {d.vasche.map((v) => (
          <button key={v.id} onClick={() => vai({ nome: "modificaVasca", id: v.id })}>
            <span><b>{v.nome}</b>{!v.attiva && <span className="pill nd" style={{ marginLeft: 6 }}>non attiva</span>}<br />
              <span className="muted small">{fmt(v.volume_l, 0)} L{v.superficie_m2 ? ` · ${fmt(v.superficie_m2, 2)} m²` : ""}{v.alias.length ? ` · detta anche «${v.alias.join("», «")}»` : ""}</span></span>
            <span className="muted">›</span>
          </button>
        ))}
      </div>
      <button className="btn wide" style={{ marginTop: 10 }} onClick={() => vai({ nome: "modificaVasca" })}>＋ Aggiungi vasca</button>

      <form className="stack" onSubmit={(e) => { e.preventDefault(); salva(); }}>
        <h3>Avvisi</h3>
        <CampoNum id="s-gl" label="Pronta per la raccolta da" unita="g/L" value={f.gl} onChange={set("gl")} />
        <div className="grid2"><CampoNum id="s-phmin" label="pH minimo" value={f.phMin} onChange={set("phMin")} /><CampoNum id="s-phmax" label="pH massimo" value={f.phMax} onChange={set("phMax")} /></div>
        <div className="grid2"><CampoNum id="s-tmin" label="Temp. minima" unita="°C" value={f.tMin} onChange={set("tMin")} /><CampoNum id="s-tmax" label="Temp. massima" unita="°C" value={f.tMax} onChange={set("tMax")} /></div>
        <div className="grid2"><CampoNum id="s-lmin" label="Altezza minima" unita="cm, vuoto = no" value={f.livMin} onChange={set("livMin")} /><CampoNum id="s-lmax" label="Altezza massima" unita="cm, vuoto = no" value={f.livMax} onChange={set("livMax")} /></div>
        <p className="small muted">Altri avvisi automatici: filamenti raddrizzati in aumento in 3 osservazioni al microscopio di fila; qualsiasi contaminante «poco» o «molto» (detriti «molto» conta solo come da tenere d'occhio).</p>
        <h3>Biomassa senza calibrazione</h3>
        <CampoNum id="s-k" label="Fattore provvisorio" unita="g/L per unità di OD750" value={f.k} onChange={set("k")} />
        <p className="formula">g/L = fattore × OD750 × diluizione · usato solo finché non hai almeno 2 punti di calibrazione.</p>
        <h3>Valori predefiniti</h3>
        <span className="small muted">Lunghezza d'onda ficocianina</span>
        <Seg valori={["620", "615"] as const} valore={lambda} onChange={setLambda} etichetta={(l) => "A" + l} />
        <span className="small muted">Ingrandimento</span>
        <Seg valori={["40x", "100x", "400x"] as const} valore={ingr as "100x"} onChange={setIngr} />
        <button className="btn primary wide" type="submit">Salva impostazioni</button>
      </form>

      <h3>Dati</h3>
      <div className="stack">
        <button className="btn wide" onClick={() => scarica(`quaderno-di-vasca-${new Date().toISOString().slice(0, 10)}.csv`, creaCsv(d.rilevazioni, d.vasche, d.m))}>Esporta tutte le rilevazioni (CSV)</button>
        <p className="small muted">Separatore punto e virgola e virgola decimale, per Excel in italiano. Contiene sia la stima AI sia la tua correzione.</p>
        <button className="btn wide" onClick={() => supabase.auth.signOut()}>Esci</button>
      </div>
    </>
  );
}
