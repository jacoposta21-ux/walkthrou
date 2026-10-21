import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { carica, svuota, useStore } from "./lib/store";
import { useRotta, vai, type Rotta } from "./router";
import { IcoMic, UiProvider } from "./components/ui";
import { Accesso } from "./views/Accesso";
import { Home } from "./views/Home";
import { Voce } from "./views/Voce";
import { Vasca } from "./views/Vasca";
import { Modulo } from "./views/Modulo";
import { Rilevazione } from "./views/Rilevazione";
import { Calibrazione } from "./views/Calibrazione";
import { Impostazioni } from "./views/Impostazioni";
import { ModificaVasca } from "./views/ModificaVasca";

const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const TABS: { r: Rotta["nome"]; l: string; ico?: string }[] = [
  { r: "home", l: "Vasche", ico: "M3 10h18M3 15h18M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" },
  { r: "nuova", l: "Rilevazione", ico: "M12 5v14M5 12h14" },
  { r: "voce", l: "Registra" },
  { r: "calibrazione", l: "Calibra", ico: "M4 20 20 4M4 20h16M4 20V4" },
  { r: "impostazioni", l: "Impostazioni", ico: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
];

function Pagina({ r }: { r: Rotta }) {
  switch (r.nome) {
    case "voce": return <Voce />;
    case "vasca": return <Vasca id={r.id} tab={r.tab} />;
    case "modificaVasca": return <ModificaVasca key={r.id ?? "nuova"} id={r.id} />;
    case "nuova": return <Modulo key={"n" + (r.vasca ?? "")} vasca={r.vasca} />;
    case "modifica": return <Modulo key={r.id} id={r.id} />;
    case "rilevazione": return <Rilevazione id={r.id} />;
    case "calibrazione": return <Calibrazione />;
    case "impostazioni": return <Impostazioni />;
    default: return <Home />;
  }
}

export function App() {
  const [sessione, setSessione] = useState<Session | null | undefined>(undefined);
  const store = useStore();
  const rotta = useRotta();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessione(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const uid = sessione?.user.id;
  useEffect(() => { if (uid) carica(); else svuota(); }, [uid]);

  if (sessione === undefined) return null;
  if (!sessione) return <UiProvider><Accesso /></UiProvider>;
  const attiva = rotta.nome === "vasca" || rotta.nome === "rilevazione" || rotta.nome === "modificaVasca" ? "home" : rotta.nome === "modifica" ? "nuova" : rotta.nome;

  return (
    <UiProvider>
      <div className="wrap">
        {!store.pronto ? <div className="empty" style={{ marginTop: 40 }}>Apro l'archivio delle vasche…</div>
          : store.errore ? <div className="banner" style={{ marginTop: 20 }}>Non riesco a leggere i dati: {store.errore}. <button className="btn sm" onClick={carica}>Riprova</button></div>
          : <Pagina r={rotta} />}
      </div>
      <nav className="tabs" aria-label="Sezioni">
        {TABS.map((t) => (
          <button key={t.r} className={t.r === "voce" ? "rec" : undefined} aria-current={attiva === t.r ? "page" : undefined} onClick={() => vai({ nome: t.r } as Rotta)}>
            {t.ico ? <Ico d={t.ico} /> : <IcoMic />}{t.l}
          </button>
        ))}
      </nav>
    </UiProvider>
  );
}
