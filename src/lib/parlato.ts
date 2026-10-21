import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API (Chrome/Android, Safari/iOS): not in the TS DOM lib yet.
interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
const Ctor = (): (new () => SR) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const parlatoDisponibile = () => Ctor() !== null;

/** Continuous Italian dictation. `testo` keeps growing across pauses until stop(). */
export function useDettatura() {
  const [attivo, setAttivo] = useState(false);
  const [testo, setTesto] = useState("");
  const [provvisorio, setProvvisorio] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const vuole = useRef(false);
  const base = useRef("");

  const avvia = useCallback(() => {
    const C = Ctor();
    if (!C) { setErrore("Il riconoscimento vocale non è disponibile su questo browser. Usa Chrome su Android o Safari su iPhone, oppure scrivi il testo."); return; }
    setErrore(null);
    vuole.current = true;
    const r = new C();
    r.lang = "it-IT";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let fin = "", tmp = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t + " "; else tmp += t;
      }
      setTesto((base.current + " " + fin).replace(/\s+/g, " ").trim());
      setProvvisorio(tmp);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { vuole.current = false; setErrore("Permesso microfono negato. Abilitalo nelle impostazioni del browser."); }
      else if (e.error !== "no-speech" && e.error !== "aborted") setErrore("Riconoscimento interrotto: " + e.error);
    };
    r.onend = () => {
      // phones stop after a pause: restart until the user presses stop
      setProvvisorio("");
      if (vuole.current) {
        setTesto((t) => { base.current = t; return t; });
        try { r.start(); return; } catch { /* fall through */ }
      }
      setAttivo(false);
    };
    rec.current = r;
    setTesto((t) => { base.current = t; return t; });
    r.start();
    setAttivo(true);
  }, []);

  const ferma = useCallback(() => { vuole.current = false; rec.current?.stop(); setAttivo(false); }, []);
  const azzera = useCallback(() => { base.current = ""; setTesto(""); setProvvisorio(""); }, []);
  useEffect(() => () => { vuole.current = false; rec.current?.abort(); }, []);

  return { attivo, testo, setTesto: (t: string) => { base.current = t; setTesto(t); }, provvisorio, errore, avvia, ferma, azzera };
}
