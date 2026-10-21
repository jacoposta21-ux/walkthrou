import { useRef, useState } from "react";
import { fmt, fmtDate } from "../lib/format";

export interface Punto { ts: number; v: number }
interface Rif { v: number | null; colore: string; etichetta: string }

const W = 640, H = 200, L = 46, R = 14, T = 12, B = 28;

/** One-series line chart over time, with dashed threshold lines and a tap/hover readout. */
export function Grafico({ titolo, unita, sotto, punti, dec = 1, zero, rif = [] }: { titolo: string; unita: string; sotto: string; punti: Punto[]; dec?: number; zero?: boolean; rif?: Rif[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Punto | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const refs = rif.filter((r): r is Rif & { v: number } => r.v !== null);

  if (!punti.length)
    return (
      <div className="chart"><div className="ttl"><b>{titolo} {unita && <span className="muted mono small">{unita}</span>}</b><span className="muted small">{sotto}</span></div>
        <p className="muted small" style={{ padding: "12px 0" }}>Nessun dato ancora.</p></div>
    );

  const ys = [...punti.map((p) => p.v), ...refs.map((r) => r.v)];
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (zero) y0 = Math.min(0, y0);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08;
  if (!(zero && y0 === 0)) y0 -= pad;
  y1 += pad;
  const x0 = punti[0].ts, x1 = punti.length > 1 ? punti[punti.length - 1].ts : x0 + 864e5;
  const X = (t: number) => L + (punti.length === 1 ? (W - L - R) / 2 : ((t - x0) / (x1 - x0)) * (W - L - R));
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const d = punti.map((p, i) => `${i ? "L" : "M"}${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const xt = punti.length > 1 ? [x0, (x0 + x1) / 2, x1] : [x0];

  const muovi = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    let best = punti[0];
    for (const p of punti) if (Math.abs(X(p.ts) - sx) < Math.abs(X(best.ts) - sx)) best = p;
    const er = box.current!.getBoundingClientRect();
    setSel(best);
    setPos({
      x: Math.max(80, Math.min(er.width - 80, r.left - er.left + (X(best.ts) / W) * r.width)),
      y: r.top - er.top + (Y(best.v) / H) * r.height - 10,
    });
  };

  return (
    <div className="chart" ref={box}>
      <div className="ttl"><b>{titolo} {unita && <span className="muted mono small">{unita}</span>}</b><span className="muted small">{sotto}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titolo} onPointerMove={muovi} onPointerDown={muovi} onPointerLeave={() => setSel(null)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = y0 + ((y1 - y0) / 4) * i;
          return (
            <g key={i}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth="1" />
              <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fontFamily="var(--f-mono)" fill="var(--muted)">{fmt(v, dec)}</text>
            </g>
          );
        })}
        {xt.map((t, i) => (
          <text key={i} x={X(t)} y={H - 8} textAnchor={xt.length === 1 ? "middle" : i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="11" fill="var(--muted)">
            {new Date(t).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
          </text>
        ))}
        {refs.map((r, i) => (
          <g key={"r" + i}>
            <line x1={L} x2={W - R} y1={Y(r.v)} y2={Y(r.v)} stroke={`var(${r.colore})`} strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W - R} y={Y(r.v) - 4} textAnchor="end" fontSize="10.5" fill={`var(${r.colore})`}>{r.etichetta}</text>
          </g>
        ))}
        {punti.length > 1 && <path d={`${d}L${X(x1)},${H - B}L${X(x0)},${H - B}Z`} fill="var(--accent)" fillOpacity=".12" />}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {punti.map((p, i) => <circle key={i} cx={X(p.ts)} cy={Y(p.v)} r={i === punti.length - 1 ? 5.5 : 4} fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />)}
        {sel && <line x1={X(sel.ts)} x2={X(sel.ts)} y1={T} y2={H - B} stroke="var(--muted)" strokeWidth="1" />}
      </svg>
      {sel && <div className="tip" style={{ left: pos.x, top: pos.y }}>{fmtDate(sel.ts)} · {fmt(sel.v, dec)} {unita}</div>}
    </div>
  );
}
