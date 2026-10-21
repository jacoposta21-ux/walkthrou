export type Livello = "assente" | "poco" | "molto";
export type Lunghezza = "corti" | "medi" | "lunghi";
export type Giudizio = "sana" | "stressata" | "contaminata";

export const FILAMENTI = [
  ["spiralati", "Ben spiralati"],
  ["raddrizzati", "Raddrizzati"],
  ["spezzati", "Spezzati"],
  ["morti", "Morti"],
] as const;
export const CONTAMINANTI = [
  ["altre_alghe", "Altre alghe"],
  ["protozoi", "Protozoi"],
  ["rotiferi", "Rotiferi"],
  ["batteri", "Batteri"],
  ["detriti", "Detriti"],
] as const;
export const LIVELLI: Livello[] = ["assente", "poco", "molto"];
export const LUNGHEZZE: Lunghezza[] = ["corti", "medi", "lunghi"];
export const GIUDIZI: Giudizio[] = ["sana", "stressata", "contaminata"];

export type FilKey = (typeof FILAMENTI)[number][0];
export type ContKey = (typeof CONTAMINANTI)[number][0];

export interface Valutazione {
  spiralati: number | null;
  raddrizzati: number | null;
  spezzati: number | null;
  morti: number | null;
  lunghezza: Lunghezza | null;
  contaminanti: Record<ContKey, Livello>;
  giudizio: Giudizio | null;
}
export interface ValutazioneAI extends Valutazione {
  utilizzabile: boolean;
  motivo_inutilizzabile: string | null;
  spiegazione: string;
  confidenza: number;
  quando: string;
}
export interface Micro {
  foto: string[]; // storage paths in the "foto" bucket
  ingrandimento: string;
  ai: ValutazioneAI | null;
  corr: Valutazione | null;
}
export interface Ficocianina {
  lambda: "620" | "615";
  aPC: number | null;
  a652: number | null;
  a280: number | null;
  vol: number | null; // mL buffer
  massa: number | null; // mg dry biomass extracted
}

export interface Vasca {
  id: string;
  numero: number;
  nome: string;
  alias: string[];
  volume_l: number;
  superficie_m2: number | null;
  inoculo: string | null;
  ceppo: string;
  attiva: boolean;
}

export interface Rilevazione {
  id: string;
  vasca_id: string;
  ts: string;
  ph: number | null;
  temp: number | null;
  livello_cm: number | null;
  od750: number | null;
  diluizione: number;
  pc: Ficocianina | null;
  micro: Micro | null;
  note: string;
  fonte: "manuale" | "voce";
  trascrizione: string | null;
}

export interface PuntoCalibrazione {
  id: string;
  od: number;
  gl: number;
}

export interface Impostazioni {
  glRaccolta: number;
  phMin: number;
  phMax: number;
  tMin: number;
  tMax: number;
  livelloMin: number | null;
  livelloMax: number | null;
  kProvv: number;
  lambdaPC: "620" | "615";
  ingrandimento: string;
}

export const DEFAULTS: Impostazioni = {
  glRaccolta: 1.0,
  phMin: 9.5,
  phMax: 11,
  tMin: 25,
  tMax: 38,
  livelloMin: null,
  livelloMax: null,
  kProvv: 0.55,
  lambdaPC: "620",
  ingrandimento: "100x",
};
