# Quaderno di Vasca

Web app per registrare e monitorare le colture di spirulina in 11 vasche
(1–2 da 1.000 L, 3–4 da 4.000 L, 5–11 da 10.000 L).

- **Registra a voce** dalla home: «vasca 1 altezza 23, vasca 3 pH 10,4 temperatura 31…».
  Claude interpreta il testo dettato; senza AI resta un interprete a regole (`src/lib/voce.ts`).
  Prima di salvare si controlla e corregge tutto.
- **Rilevazione completa**: altezza liquido, pH, temperatura, OD750 → g/L, ficocianina
  (Bennett & Bogorad), foto al microscopio con analisi AI correggibile.
- **Avvisi** per raccolta, pH, temperatura, altezza, filamenti raddrizzati, contaminazioni.
- **Calibrazione** OD750 → peso secco con retta e R²; **CSV** per Excel italiano.

## Struttura

- `src/` app React + Vite (`views/` schermate, `components/`, `lib/` calcoli, dati, voce)
- `supabase/functions/ai` funzione server che chiama Claude (voce e foto)
- Database e foto su Supabase (progetto `quaderno-di-vasca`), con accesso riservato a ogni utente.

## Sviluppo

```
npm install
npm run dev
npm test
```

La funzione AI usa il segreto `ANTHROPIC_API_KEY` impostato nel progetto Supabase.
Solo le email nella tabella `ammessi` possono usare l'AI.
