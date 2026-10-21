import { useState } from "react";
import { supabase } from "../lib/supabase";

export function Accesso() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [modo, setModo] = useState<"entra" | "registrati">("entra");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [lav, setLav] = useState(false);

  const invia = async () => {
    setLav(true);
    setMsg(null);
    const r = modo === "entra"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } });
    setLav(false);
    if (r.error) return setMsg({ t: r.error.message === "Invalid login credentials" ? "Email o password sbagliate." : r.error.message, err: true });
    if (modo === "registrati" && !r.data.session) setMsg({ t: "Ti ho mandato un'email: apri il link per confermare, poi entra qui." });
  };

  return (
    <main className="login">
      <h1>Quaderno di Vasca</h1>
      <p className="muted">Il registro delle tue vasche di spirulina.</p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); invia(); }}>
        <label className="f" htmlFor="a-email">Email<input id="a-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="f" htmlFor="a-pw">Password<input id="a-pw" type="password" autoComplete={modo === "entra" ? "current-password" : "new-password"} minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <button className="btn primary wide" disabled={lav}>{lav ? <span className="spin" /> : modo === "entra" ? "Entra" : "Crea account"}</button>
      </form>
      {msg && <div className={msg.err ? "alert problema" : "alert info"}><span className="ic">{msg.err ? "!" : "✓"}</span><div><span>{msg.t}</span></div></div>}
      <button className="btn wide" onClick={() => { setModo(modo === "entra" ? "registrati" : "entra"); setMsg(null); }}>
        {modo === "entra" ? "Primo accesso? Crea l'account" : "Ho già un account"}
      </button>
    </main>
  );
}
