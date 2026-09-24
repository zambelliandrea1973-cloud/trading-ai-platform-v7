# Strategy Comparison Lab — 5 Cervelli vs Berto

## Invarianti

1. `FIVE_BRAINS_STRATEGY` e `BERTO_GOLDEN_SETUP` sono motori autonomi.
2. Ricevono lo stesso feed Axi, lo stesso capitale iniziale e lo stesso intervallo storico.
3. Portafogli, ordini virtuali, P&L, drawdown e cronologie restano separati.
4. Nessun segnale, punteggio, veto o risultato attraversa il confine tra strategie.
5. `executionEnabled` resta hardcoded a `false`.
6. Il laboratorio non può selezionare o abilitare automaticamente il LIVE.

## Flusso

```text
Feed Axi normalizzato
  ├─> FIVE_BRAINS_STRATEGY ─> portafoglio PAPER A ─> metriche A
  └─> BERTO_GOLDEN_SETUP  ─> portafoglio PAPER B ─> metriche B

metriche A + metriche B ─> dashboard di osservazione (nessun feedback ai motori)
```

## Berto Golden Setup 1.0.0

- Segnale: candela regolare QQQ del giorno precedente.
- Se `close <= open`: giornata sospesa.
- Suffissi: centesimi del Low e dell'High.
- Distanza circolare: `min(abs(A-B), 100-abs(A-B))`.
- Se distanza < 10: conserva il suffisso numericamente inferiore.
- Livelli: suffissi proiettati sulla griglia US500 ogni 100 punti.
- Solo livelli sotto il Session Open e distanti almeno 20 punti.
- Fuso canonico: `America/New_York`.
- 09:30–09:59 ET: ogni primo tocco invalida il livello per la giornata.
- Da 10:00 ET: primo tocco valido, solo LONG.
- Stop loss: 31 punti.
- Take profit: 89 punti.
- Alle 15:55 ET: chiusura di posizioni e scadenza degli ordini.
- Overnight vietato.
- Rischio originale osservato: 5% per trade.
- Confronto normalizzato: 0,5% per trade.
- Modalità: SHADOW; esecuzione reale impossibile.

## API

- `GET /api/strategy-comparison`: contratto del laboratorio, capitale comune e metriche.
- `POST /api/strategy-comparison/berto/plan`: calcola il piano giornaliero Berto da OHLC QQQ e Session Open US500.

Esempio body:

```json
{
  "qqq": { "open": 724, "high": 737.62, "low": 724.18, "close": 735 },
  "sp500SessionOpen": 7529.55,
  "depth": 8
}
```

## Criterio di revisione

La dashboard non indica un vincitore prima di almeno 100 operazioni chiuse per strategia.
La successiva decisione umana deve considerare rendimento netto, expectancy in R,
profit factor, drawdown, costi, stabilità per regime e prova fuori campione.

## Stato della persistenza

Il motore, l'API di pianificazione e il calcolo delle metriche sono implementati.
Il collegamento dei trade PAPER prodotti dai due executor al registro persistente
deve essere completato quando entrambi gli executor ricevono il medesimo feed
storico/live. Fino ad allora la dashboard mostra zero e non inventa risultati.
