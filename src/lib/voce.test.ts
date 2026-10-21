import { describe, expect, it } from "vitest";
import { interpretaLocale, normalizzaNumeri, parolaNumero } from "./voce";
import type { Vasca } from "./types";

const vasche: Vasca[] = Array.from({ length: 11 }, (_, i) => ({
  id: "v" + (i + 1), numero: i + 1, nome: i === 2 ? "Grande Nord" : `Vasca ${i + 1}`, alias: [], volume_l: 1000,
  superficie_m2: null, inoculo: null, ceppo: "", attiva: true,
}));

describe("numeri a parole", () => {
  it("converte", () => {
    expect(parolaNumero("ventitré")).toBe(23);
    expect(parolaNumero("trentotto")).toBe(38);
    expect(parolaNumero("centoquindici")).toBe(115);
    expect(normalizzaNumeri("pH dieci virgola due")).toBe("ph 10,2");
    expect(normalizzaNumeri("trenta e mezzo gradi")).toBe("30,5 gradi");
  });
});

describe("interpretaLocale", () => {
  it("più vasche e campi", () => {
    const r = interpretaLocale("Vasca 1 l'altezza è 23 centimetri, vasca 2 l'altezza è 21. Vasca 3 il pH è 10,4 e la temperatura 31 gradi", vasche);
    expect(r.letture.map((l) => [l.vasca_id, l.campo, l.valore])).toEqual([
      ["v1", "livello_cm", 23],
      ["v2", "livello_cm", 21],
      ["v3", "ph", 10.4],
      ["v3", "temp", 31],
    ]);
  });
  it("numeri a voce, metri e note", () => {
    const r = interpretaLocale("vasca undici ph dieci virgola sette altezza zero virgola due metri nota schiuma in superficie", vasche);
    expect(r.letture.map((l) => [l.vasca_id, l.campo, l.valore])).toEqual([
      ["v11", "ph", 10.7],
      ["v11", "livello_cm", 20],
      ["v11", "note", "schiuma in superficie"],
    ]);
  });
  it("nome personalizzato", () => {
    const r = interpretaLocale("grande nord temperatura 29", vasche);
    expect(r.letture[0]).toMatchObject({ vasca_id: "v3", campo: "temp", valore: 29 });
  });
});
