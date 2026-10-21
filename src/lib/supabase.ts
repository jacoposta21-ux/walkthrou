import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Calls the "ai" edge function; throws an Error with an Italian message on failure. */
export async function chiediAI<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai", { body });
  if (error) {
    let msg = "Servizio AI non raggiungibile.";
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx && (await ctx.json());
      if (j?.errore) msg = j.errore[0].toUpperCase() + j.errore.slice(1) + ".";
    } catch { /* keep generic message */ }
    throw new Error(msg);
  }
  return data as T;
}
