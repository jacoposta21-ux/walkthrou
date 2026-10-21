import { supabase } from "./supabase";

/** Re-encodes a phone photo as a JPEG no larger than `max` px on the long side. */
export function riduci(file: Blob, max = 1600): Promise<Blob> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); res(b ?? file); }, "image/jpeg", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

export const base64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

export async function caricaFoto(blob: Blob): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const path = `${u.user!.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("foto").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

const cache = new Map<string, string>();
export async function urlFoto(paths: string[]): Promise<Record<string, string>> {
  const mancano = paths.filter((p) => !cache.has(p));
  if (mancano.length) {
    const { data } = await supabase.storage.from("foto").createSignedUrls(mancano, 60 * 60 * 6);
    data?.forEach((d) => d.signedUrl && d.path && cache.set(d.path, d.signedUrl));
  }
  return Object.fromEntries(paths.filter((p) => cache.has(p)).map((p) => [p, cache.get(p)!]));
}

export async function scaricaFoto(path: string): Promise<Blob | null> {
  const { data } = await supabase.storage.from("foto").download(path);
  return data ?? null;
}
