export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const fmt = (n: number | null | undefined, d = 2): string =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtDate = (ts: string | number) =>
  new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const fmtDay = (ts: string | number) =>
  new Date(ts).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

/** Value for an <input type="datetime-local"> in local time. */
export const localInput = (ts: string | number) => {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Number shown in an editable field, with Italian decimal comma. */
export const inputStr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
