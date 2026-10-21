import { useState } from "react";
import { useDerivati } from "../lib/derivati";
import { aggiungiPunto, eliminaPunto } from "../lib/store";
import { fmt, num } from "../lib/format";
import { CampoNum, Header, useUi } from "../components/ui";

export function Calibrazione() {
  const d = useDerivati();
  const { toast } = useUi();
  const [od, setOd] = useState("");
  const [gl, setGl] = useState("");
  const m = d.m, pts = d.calibrazione;

  const W = 640, H = 220, L = 46, R = 14, T = 12, B = 30;
  const xm = Math.max(0.1, ...pts.map((p) => p.od)) * 1.1, ym = Math.max(0.1, ...pts.map((p) => p.gl)) * 1.1;
  const X = (x: number) => L + (x / xm) * (W - L - R), Y = (y: number) => T + (1 - y / ym) * (H - T - B);

  const aggiungi = async () => {
    const o = num(od), g = num(gl);
    if (o === null || g === null) return toast("Inserisci OD e g/L.");
    await aggiungiPunto(o, g);
    setOd(""); setGl("");
    toast("Punto aggiunto");
  };

  return (
    <>
      <Header titolo="Calibrazione" />
      <p className="muted small">Coppie misurate da te: OD750 effettiva (già moltiplicata per la diluizione) e peso secco in g/L. Servono almeno 2 punti, meglio 5 o più su tutta la gamma di densità.</p>
      {m.tipo === "calibrazione" ? (
        <div className="readout">
          <span className="lab">Retta attiva · {m.n} punti</span>
          <span className="val">g/L = {fmt(m.a, 4)} × OD {m.b < 0 ? "−" : "+"} {fmt(Math.abs(m.b), 4)}</span>
          <span className="val" style={{ fontSize: "1.05rem" }}>R² = {fmt(m.r2, 4)}</span>
          {m.r2 < 0.95 && <span className="estimate">R² basso: controlla i punti o aggiungine altri.</span>}
          {m.n < 3 && <span className="estimate">Solo {m.n} punti: la retta è poco affidabile.</span>}
          <span className="formula">Minimi quadrati: a = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)², b = ȳ − a·x̄, R² = [Σ(x−x̄)(y−ȳ)]² / [Σ(x−x̄)² · Σ(y−ȳ)²]</span>
        </div>
      ) : (
        <div className="readout"><span className="lab">Nessuna calibrazione</span><span className="val">g/L = {fmt(m.k, 3)} × OD</span><span className="estimate">Fattore provvisorio: tutti i g/L sono stime.</span><span className="formula">Il fattore si cambia in Impostazioni.</span></div>
      )}
      <div className="chart" style={{ marginTop: 12 }}>
        <div className="ttl"><b>Punti e retta</b><span className="muted small">x = OD750 eff. · y = g/L</span></div>
        {pts.length ? (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Retta di calibrazione">
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line x1={L} x2={W - R} y1={Y((ym * i) / 4)} y2={Y((ym * i) / 4)} stroke="var(--line)" />
                <text x={L - 6} y={Y((ym * i) / 4) + 4} textAnchor="end" fontSize="11" fontFamily="var(--f-mono)" fill="var(--muted)">{fmt((ym * i) / 4, 2)}</text>
                <text x={X((xm * i) / 4)} y={H - 10} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} fontSize="11" fontFamily="var(--f-mono)" fill="var(--muted)">{fmt((xm * i) / 4, 2)}</text>
              </g>
            ))}
            {m.tipo === "calibrazione" && <line x1={X(0)} y1={Y(Math.max(0, m.b))} x2={X(xm)} y2={Y(Math.min(ym, m.a * xm + m.b))} stroke="var(--accent)" strokeWidth="2" />}
            {pts.map((p) => <circle key={p.id} cx={X(p.od)} cy={Y(p.gl)} r="5" fill="var(--green)" stroke="var(--surface)" strokeWidth="2"><title>OD {fmt(p.od, 3)} · {fmt(p.gl, 3)} g/L</title></circle>)}
          </svg>
        ) : <p className="muted small" style={{ padding: "12px 0" }}>Aggiungi i punti qui sotto.</p>}
      </div>
      <h3>Aggiungi punto</h3>
      <form className="grid2" onSubmit={(e) => { e.preventDefault(); aggiungi(); }}>
        <CampoNum id="c-od" label="OD750 eff." value={od} onChange={setOd} placeholder="0,80" />
        <CampoNum id="c-gl" label="Peso secco" unita="g/L" value={gl} onChange={setGl} placeholder="0,45" />
        <button className="btn primary" style={{ gridColumn: "1 / -1" }} type="submit">＋ Aggiungi punto</button>
      </form>
      {pts.length > 0 && (
        <>
          <h3>Punti ({pts.length})</h3>
          <div className="tbl-wrap"><table>
            <thead><tr><th className="num">OD750</th><th className="num">g/L</th><th className="num">residuo</th><th /></tr></thead>
            <tbody>{pts.map((p) => (
              <tr key={p.id}>
                <td className="num">{fmt(p.od, 3)}</td><td className="num">{fmt(p.gl, 3)}</td>
                <td className="num">{m.tipo === "calibrazione" ? fmt(p.gl - (m.a * p.od + m.b), 3) : "—"}</td>
                <td><button className="btn sm danger" aria-label="Elimina punto" onClick={() => eliminaPunto(p.id)}>×</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </>
  );
}
