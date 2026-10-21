import { useState } from "react";
import { useStore, salvaVasca, eliminaVasca } from "../lib/store";
import { inputStr, num } from "../lib/format";
import { vai } from "../router";
import { CampoNum, Header, useUi } from "../components/ui";

export function ModificaVasca({ id }: { id?: string }) {
  const { vasche, rilevazioni } = useStore();
  const { toast, conferma } = useUi();
  const v = id ? vasche.find((x) => x.id === id) : undefined;
  const prossimo = Math.max(0, ...vasche.map((x) => x.numero)) + 1;
  const [f, setF] = useState({
    numero: String(v?.numero ?? prossimo), nome: v?.nome ?? `Vasca ${prossimo}`, alias: v?.alias.join(", ") ?? "",
    volume: inputStr(v?.volume_l ?? 10000), sup: inputStr(v?.superficie_m2), inoculo: v?.inoculo ?? "", ceppo: v?.ceppo ?? "", attiva: v?.attiva ?? true,
  });
  const set = (k: keyof typeof f) => (x: string) => setF((o) => ({ ...o, [k]: x }));

  const salva = async () => {
    const numero = Number(f.numero), volume = num(f.volume);
    if (!f.nome.trim() || !Number.isInteger(numero) || !volume) return toast("Servono numero, nome e volume.");
    if (vasche.some((x) => x.numero === numero && x.id !== id)) return toast(`Il numero ${numero} è già usato.`);
    try {
      const r = await salvaVasca({
        id, numero, nome: f.nome.trim(), alias: f.alias.split(",").map((a) => a.trim()).filter(Boolean),
        volume_l: volume, superficie_m2: num(f.sup), inoculo: f.inoculo || null, ceppo: f.ceppo.trim(), attiva: f.attiva,
      });
      toast("Vasca salvata");
      vai({ nome: "vasca", id: r.id }, true);
    } catch (e) { toast("Salvataggio non riuscito: " + (e instanceof Error ? e.message : "")); }
  };

  const n = v ? rilevazioni.filter((r) => r.vasca_id === v.id).length : 0;
  return (
    <>
      <Header titolo={v ? `Modifica ${v.nome}` : "Nuova vasca"} back />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salva(); }}>
        <div className="grid2">
          <CampoNum id="v-num" label="Numero" value={f.numero} onChange={set("numero")} />
          <CampoNum id="v-vol" label="Volume" unita="L" value={f.volume} onChange={set("volume")} />
        </div>
        <label className="f" htmlFor="v-nome">Nome<input id="v-nome" value={f.nome} onChange={(e) => set("nome")(e.target.value)} /></label>
        <label className="f" htmlFor="v-alias">Altri nomi per la voce <span className="u">separati da virgola, es. «la grande, nord»</span>
          <input id="v-alias" value={f.alias} onChange={(e) => set("alias")(e.target.value)} /></label>
        <CampoNum id="v-sup" label="Superficie" unita="m², serve per il volume dall'altezza" value={f.sup} onChange={set("sup")} />
        <div className="grid2">
          <label className="f" htmlFor="v-ino">Data di inoculo<input id="v-ino" type="date" value={f.inoculo} onChange={(e) => set("inoculo")(e.target.value)} /></label>
          <label className="f" htmlFor="v-ceppo">Ceppo<input id="v-ceppo" value={f.ceppo} placeholder="es. Paracas" onChange={(e) => set("ceppo")(e.target.value)} /></label>
        </div>
        <label className="row" style={{ minHeight: 48 }}><input type="checkbox" style={{ width: 28, minHeight: 28 }} checked={f.attiva} onChange={(e) => setF((o) => ({ ...o, attiva: e.target.checked }))} /> Vasca attiva (compare in home)</label>
        <button className="btn primary wide" type="submit">Salva vasca</button>
        {v && (
          <button type="button" className="btn danger wide" onClick={() => conferma({
            titolo: `Eliminare ${v.nome}?`, testo: `Elimino la vasca e le sue ${n} rilevazioni. Non si può annullare. Se la svuoti solo per un periodo, togli invece «Vasca attiva».`, ok: "Elimina",
            onOk: async () => { await eliminaVasca(v.id); toast("Vasca eliminata"); vai({ nome: "home" }, true); },
          })}>Elimina vasca</button>
        )}
      </form>
    </>
  );
}
