// Quaderno di Vasca AI: reads voice transcripts into tank readings, and evaluates microscope photos.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";

const MODEL = "claude-opus-5-5";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const LIV = { type: "string", enum: ["assente", "poco", "molto"] };
const SCHEMA_FOTO = {
  type: "object",
  additionalProperties: false,
  required: ["utilizzabile", "motivo_inutilizzabile", "spiralati", "raddrizzati", "spezzati", "morti", "lunghezza", "contaminanti", "giudizio", "spiegazione", "confidenza"],
  properties: {
    utilizzabile: { type: "boolean" },
    motivo_inutilizzabile: { type: ["string", "null"] },
    spiralati: { type: "integer" },
    raddrizzati: { type: "integer" },
    spezzati: { type: "integer" },
    morti: { type: "integer" },
    lunghezza: { type: "string", enum: ["corti", "medi", "lunghi"] },
    contaminanti: {
      type: "object",
      additionalProperties: false,
      required: ["altre_alghe", "protozoi", "rotiferi", "batteri", "detriti"],
      properties: { altre_alghe: LIV, protozoi: LIV, rotiferi: LIV, batteri: LIV, detriti: LIV },
    },
    giudizio: { type: "string", enum: ["sana", "stressata", "contaminata"] },
    spiegazione: { type: "string" },
    confidenza: { type: "integer" },
  },
};

const SCHEMA_VOCE = {
  type: "object",
  additionalProperties: false,
  required: ["letture", "non_capito"],
  properties: {
    letture: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["vasca_id", "vasca_detta", "campo", "valore_numero", "valore_testo", "testo"],
        properties: {
          vasca_id: { type: ["string", "null"] },
          vasca_detta: { type: "string" },
          campo: { type: "string", enum: ["ph", "temp", "livello_cm", "od750", "diluizione", "note"] },
          valore_numero: { type: ["number", "null"] },
          valore_testo: { type: ["string", "null"] },
          testo: { type: "string" },
        },
      },
    },
    non_capito: { type: "array", items: { type: "string" } },
  },
};

async function chiedi(content: Anthropic.ContentBlockParam[], schema: object, effort: "low" | "medium") {
  // deno-lint-ignore no-explicit-any
  const res: any = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content }],
  // deno-lint-ignore no-explicit-any
  } as any);
  if (res.stop_reason === "refusal") throw new Error("rifiutato");
  const text = res.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return JSON.parse(text);
}

function promptVoce(trascrizione: string, vasche: { id: string; numero: number; nome: string; alias: string[] }[]) {
  const elenco = vasche.map((v) => `- id ${v.id}: numero ${v.numero}, nome "${v.nome}"${v.alias?.length ? `, chiamata anche ${v.alias.map((a) => `"${a}"`).join(", ")}` : ""}`).join("\n");
  return `Un coltivatore di spirulina ha dettato a voce, camminando in serra, le misure delle sue vasche. Il testo viene dal riconoscimento vocale del telefono e può contenere errori di trascrizione (per esempio "piacca" per pH, "vasca tre" o "la tre" per la vasca 3, numeri scritti a parole).

Vasche esistenti:
${elenco}

Estrai ogni misura come una lettura separata:
- campo "ph": pH della coltura.
- campo "temp": temperatura in °C.
- campo "livello_cm": altezza o livello del liquido nella vasca, in centimetri. Converti metri e millimetri in centimetri.
- campo "od750": assorbanza letta allo spettrofotometro a 750 nm (OD, densità ottica).
- campo "diluizione": fattore di diluizione del campione per la lettura OD.
- campo "note": osservazioni a parole (colore, schiuma, odore, interventi fatti). Metti il testo in valore_testo.
Per i campi numerici metti il numero in valore_numero (punto decimale) e valore_testo null; per "note" il contrario.
Una misura si riferisce all'ultima vasca nominata prima di essa. vasca_id è l'id della vasca nell'elenco; se la vasca nominata non esiste metti null. vasca_detta è come l'ha chiamata. testo è il pezzo di frase da cui hai preso il valore.
Se un pezzo non riesci a capirlo o a collegarlo a una vasca, mettilo in non_capito invece di indovinare. Non inventare valori.

Trascrizione:
"""${trascrizione}"""`;
}

function promptFoto(n: number, ingrandimento: string, esempi: string) {
  return `Sei un esperto di colture di spirulina (Arthrospira platensis). Le ${n} immagini sono foto scattate con il telefono all'oculare di un microscopio ottico, ingrandimento ${ingrandimento}, di un campione della stessa vasca. Valuta lo stato dei filamenti nell'insieme delle foto.

Stima:
- percentuale di filamenti ben spiralati, raddrizzati (diritti o quasi), spezzati (frammenti corti), morti (scoloriti, svuotati, granulosi). Le quattro percentuali sommano a 100, in multipli di 5.
- lunghezza indicativa dei filamenti: corti, medi o lunghi.
- contaminanti: per ognuno assente, poco o molto.
- giudizio sintetico: sana, stressata o contaminata, con una frase di spiegazione in italiano.
- confidenza nel giudizio da 0 a 100.
- se le foto sono inutilizzabili (sfocate, troppo buie, ingrandimento sbagliato, nessun filamento visibile) metti utilizzabile=false e spiega il motivo in motivo_inutilizzabile; dai comunque la stima migliore con confidenza bassa. Altrimenti motivo_inutilizzabile è null.
${esempi ? `\nIn passato il coltivatore ha corretto le tue stime così. Adegua il tuo metro al suo:\n${esempi}\n` : ""}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ errore: "metodo non ammesso" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  const email = u?.user?.email?.toLowerCase();
  if (!email) return json({ errore: "accesso richiesto" }, 401);
  const { data: ok } = await admin.from("ammessi").select("email").eq("email", email).maybeSingle();
  if (!ok) return json({ errore: "utente non abilitato all'analisi AI" }, 403);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ errore: "chiave API Anthropic non configurata" }, 503);

  try {
    const body = await req.json();
    if (body.azione === "voce") {
      const trascrizione = String(body.trascrizione ?? "").slice(0, 8000);
      if (!trascrizione.trim()) return json({ letture: [], non_capito: [] });
      const r = await chiedi([{ type: "text", text: promptVoce(trascrizione, body.vasche ?? []) }], SCHEMA_VOCE, "low");
      const letture = (r.letture ?? []).map((l: Record<string, unknown>) => ({
        vasca_id: l.vasca_id, vasca_detta: l.vasca_detta, campo: l.campo, testo: l.testo,
        valore: l.campo === "note" ? String(l.valore_testo ?? "") : l.valore_numero,
      })).filter((l: { valore: unknown }) => l.valore !== null && l.valore !== "");
      return json({ letture, non_capito: r.non_capito ?? [] });
    }
    if (body.azione === "foto") {
      const imgs: string[] = (body.immagini ?? []).slice(0, 5);
      if (!imgs.length) return json({ errore: "nessuna foto" }, 400);
      const content: Anthropic.ContentBlockParam[] = imgs.map((data) => ({
        type: "image", source: { type: "base64", media_type: "image/jpeg", data },
      }));
      content.push({ type: "text", text: promptFoto(imgs.length, String(body.ingrandimento ?? "100x"), String(body.esempi ?? "").slice(0, 4000)) });
      return json(await chiedi(content, SCHEMA_FOTO, "medium"));
    }
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ errore: "troppe richieste, riprova tra poco" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ errore: "chiave API Anthropic non valida" }, 503);
    if (e instanceof Anthropic.APIError) return json({ errore: `errore del servizio AI (${e.status})` }, 502);
    return json({ errore: e instanceof Error ? e.message : "errore" }, 500);
  }
});
