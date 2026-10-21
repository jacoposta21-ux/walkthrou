import { useState } from "react";
import { biomassa, ficocianina } from "../lib/calc";
import { useDerivati } from "../lib/derivati";
import { salvaRilevazioni } from "../lib/store";
import { fmt, inputStr, localInput, num } from "../lib/format";
import type { Ficocianina, Micro, Rilevazione } from "../lib/types";
import { vai } from "../router";
import { CampoNum, Header, Seg, useUi } from "../components/ui";
import { Microscopio } from "../components/Microscopio";

/** Full manual reading: chemistry, spectrophotometer, phycocyanin and microscope. */
export function Modulo({ id, vasca }: { id?: string; vasca?: string }) {
  const d = useDerivati();
  const { toast } = useUi();
  const esistente = id ? d.rilevazioni.find((r) => r.id === id) : undefined;
  const [vascaId, setVascaId] = useState(esistente?.vasca_id ?? vasca ?? d.vasche[0]?.id);
  const [ts, setTs] = useState(localInput(esistente?.ts ?? Date.now()));
  const [f, setF] = useState({
    ph: inputStr(esistente?.ph), temp: inputStr(esistente?.temp), livello: inputStr(esistente?.livello_cm),
    od: inputStr(esistente?.od750), dil: inputStr(esistente?.diluizione ?? 1), note: esistente?.note ?? "",
  });
  const [pc, setPc] = useState({
    lambda: (esistente?.pc?.lambda ?? d.impostazioni.lambdaPC) as Ficocianina["lambda"],
    aPC: inputStr(esistente?.pc?.aPC), a652: inputStr(esistente?.pc?.a652), a280: inputStr(esistente?.pc?.a280),
    vol: inputStr(esistente?.pc?.vol), massa: inputStr(esistente?.pc?.massa),
  });
  const [micro, setMicro] = useState<Micro>(esistente?.micro ?? { foto: [], ingrandimento: d.impostazioni.ingrandimento, ai: null, corr: null });
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const setP = (k: keyof typeof pc) => (v: string) => setPc((x) => ({ ...x, [k]: v }));

  const pcNum: Ficocianina = { lambda: pc.lambda, aPC: num(pc.aPC), a652: num(pc.a652), a280: num(pc.a280), vol: num(pc.vol), massa: num(pc.massa) };
  const haPc = [pcNum.aPC, pcNum.a652, pcNum.a280, pcNum.vol, pcNum.massa].some((x) => x !== null);
  const b = biomassa({ od750: num(f.od), diluizione: num(f.dil) ?? 1 }, d.m);
  const p = ficocianina(pcNum);

  const salva = async () => {
    if (!vascaId) return toast("Scegli una vasca.");
    const usaMicro = micro.foto.length > 0 || micro.ai || micro.corr;
    const riga: Omit<Rilevazione, "id"> & { id?: string } = {
      id: esistente?.id, vasca_id: vascaId, ts: new Date(ts).toISOString(),
      ph: num(f.ph), temp: num(f.temp), livello_cm: num(f.livello), od750: num(f.od), diluizione: num(f.dil) ?? 1,
      pc: haPc ? pcNum : null, micro: usaMicro ? micro : null, note: f.note.trim(),
      fonte: esistente?.fonte ?? "manuale", trascrizione: esistente?.trascrizione ?? null,
    };
    setSalvando(true);
    try {
      const [r] = await salvaRilevazioni([riga]);
      toast("Rilevazione salvata");
      vai({ nome: "rilevazione", id: r.id }, true);
    } catch (e) {
      toast("Salvataggio non riuscito: " + (e instanceof Error ? e.message : ""));
      setSalvando(false);
    }
  };

  return (
    <>
      <Header titolo={esistente ? "Modifica rilevazione" : "Nuova rilevazione"} back />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salva(); }} noValidate>
        <h3 style={{ marginTop: 0 }}>Vasca</h3>
        <div className="seg">
          {d.vasche.filter((v) => v.attiva || v.id === vascaId).map((v) => (
            <button type="button" key={v.id} aria-pressed={vascaId === v.id} onClick={() => setVascaId(v.id)}>{v.nome.replace(/^Vasca\s+/, "")}</button>
          ))}
        </div>
        <label className="f" htmlFor="m-ts">Data e ora<input id="m-ts" type="datetime-local" value={ts} onChange={(e) => setTs(e.target.value)} /></label>
        <div className="grid3">
          <CampoNum id="m-liv" label="Altezza" unita="cm" value={f.livello} onChange={set("livello")} placeholder="22" />
          <CampoNum id="m-ph" label="pH" value={f.ph} onChange={set("ph")} placeholder="10,2" />
          <CampoNum id="m-t" label="Temp." unita="°C" value={f.temp} onChange={set("temp")} placeholder="31" />
        </div>

        <h3>Densità · spettrofotometro</h3>
        <div className="grid2">
          <CampoNum id="m-od" label="OD750" unita="assorbanza letta" value={f.od} onChange={set("od")} placeholder="0,412" />
          <CampoNum id="m-dil" label="Diluizione" unita="× (1 = nessuna)" value={f.dil} onChange={set("dil")} />
        </div>
        <Seg valori={["1", "2", "5", "10"] as const} valore={(["1", "2", "5", "10"] as const).find((x) => num(f.dil) === Number(x)) ?? null} onChange={set("dil")} etichetta={(x) => "×" + x} />
        <div className="readout">
          {b ? (<><span className="lab">Biomassa secca</span><span className="val">{fmt(b.gl)} g/L</span>{b.stima && <span className="estimate">Stima: fattore provvisorio, nessuna calibrazione</span>}<span className="formula">{b.formula}</span></>)
            : (<><span className="lab">Inserisci OD750 per calcolare i g/L.</span><span className="formula">g/L = {d.m.tipo === "calibrazione" ? "a × OD750 × diluizione + b" : "k × OD750 × diluizione"}</span></>)}
        </div>

        <details className="sec" open={haPc}>
          <summary>Ficocianina (facoltativa)</summary>
          <div className="in">
            <Seg valori={["620", "615"] as const} valore={pc.lambda} onChange={(l) => setPc((x) => ({ ...x, lambda: l }))} etichetta={(l) => "A" + l} />
            <div className="grid2">
              <CampoNum id="m-apc" label={`A${pc.lambda}`} value={pc.aPC} onChange={setP("aPC")} />
              <CampoNum id="m-a652" label="A652" value={pc.a652} onChange={setP("a652")} />
              <CampoNum id="m-vol" label="Tampone" unita="mL" value={pc.vol} onChange={setP("vol")} />
              <CampoNum id="m-massa" label="Biomassa estratta" unita="mg secchi" value={pc.massa} onChange={setP("massa")} />
              <CampoNum id="m-a280" label="A280" unita="facoltativa" value={pc.a280} onChange={setP("a280")} />
            </div>
            <div className="readout">
              {p ? (<>
                {p.f1 && <><span className="val">{fmt(p.mgml!, 4)} mg/mL</span><span className="formula">{p.f1}</span></>}
                {p.f2 && <><span className="val">{fmt(p.resa!, 1)} mg/g</span><span className="formula">{p.f2}</span></>}
                {p.f3 && <><span className="val">Purezza {fmt(p.pur!, 2)}</span><span className="formula">{p.f3}</span></>}
              </>) : (<><span className="lab">Bennett & Bogorad</span><span className="formula">PC (mg/mL) = (A{pc.lambda} − 0,474 × A652) / 5,34 · Resa (mg/g) = PC × V / m · Purezza = A{pc.lambda} / A280</span></>)}
            </div>
          </div>
        </details>

        <h3>Microscopio</h3>
        <Microscopio micro={micro} onChange={setMicro} />

        <label className="f" htmlFor="m-note">Note<textarea id="m-note" value={f.note} placeholder="colore, schiuma, odore, interventi…" onChange={(e) => set("note")(e.target.value)} /></label>
        <div className="savebar"><button className="btn primary wide" type="submit" disabled={salvando} style={{ minHeight: 62, fontSize: "1.1rem" }}>{salvando ? <span className="spin" /> : "Salva rilevazione"}</button></div>
      </form>
    </>
  );
}
