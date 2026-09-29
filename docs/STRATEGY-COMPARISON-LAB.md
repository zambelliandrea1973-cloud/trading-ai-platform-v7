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

## Berto Breakout QQQ 4.50.0

- Segnale: candela QQQ del giorno di borsa precedente; verde = LONG, rossa = SHORT, doji = nessun trade.
- Suffissi: centesimi del Low e dell'High, con distanza circolare `min(abs(A-B), 100-abs(A-B))`.
- Se la distanza è < 10: conserva il suffisso inferiore nei LONG e quello superiore negli SHORT.
- Livelli: griglia US500 ogni 100 punti, soltanto entro 50 punti dal Session Open.
- Filtro volatilità fail-closed: range completo della precedente sessione USA < 1,3% della chiusura.
- Fuso canonico: `America/New_York`; 09:30 ET–15:55 ET, oppure 12:55 ET nelle mezze giornate.
- Il tocco nella candela M1 delle 09:30 scarta il livello; i tocchi successivi devono arrivare dal lato coerente con la direzione QQQ.
- Ingresso stop a 8 punti dal livello; inseguimento massimo 2 punti e spread massimo 2 punti.
- Stop iniziale: 13 punti dall'ingresso. Nessun take profit fisso.
- Trailing sulle candele M1 chiuse: 25 punti dal massimo/minimo; si attiva oltre 20 punti dal livello e migliora di almeno 0,2 punti.
- Un trade per livello; chiusura forzata e cancellazione dei setup a fine sessione; overnight vietato.
- Size autonoma: 2% del saldo Berto per trade, con 1% indicato come partenza prudente e massimo 50 lotti.
- Dopo una riconnessione l'adapter attende 90 secondi, ricostruisce la giornata e non insegue breakout già avvenuti.
- Festività e mezze giornate sono input di sessione versionati: in assenza di calendario valido il sistema deve bloccarsi.
- Modalità: SHADOW; esecuzione reale impossibile.

## API

- `GET /api/strategy-comparison`: contratto del laboratorio, capitale comune e metriche.
- `POST /api/strategy-comparison/berto/plan`: calcola il piano giornaliero da OHLC QQQ, Session Open US500, range USA precedente e tipo di sessione.

Esempio body:

```json
{
  "qqq": { "open": 724, "high": 737.62, "low": 724.18, "close": 735 },
  "sp500SessionOpen": 7529.55,
  "previousSession": {
    "high": 5020,
    "low": 4980,
    "close": 5000,
    "complete": true
  },
  "sessionKind": "REGULAR",
  "depth": 10
}
```

## Criterio di revisione

La dashboard non indica un vincitore prima di almeno 100 operazioni chiuse per strategia.
La successiva decisione umana deve considerare rendimento netto, expectancy in R,
profit factor, drawdown, costi, stabilità per regime e prova fuori campione.

## Persistenza

La migrazione `0002_strategy_comparison_lab.sql` crea un registro immutabile
separato per utente, esperimento, strategia e trade. Il vincolo composto impedisce
duplicazioni e mescolamenti tra i due motori.

Gli executor PAPER devono scrivere nel registro tramite
`StrategyComparisonStore.append` usando lo stesso feed e lo stesso capitale.
Finché non arrivano operazioni reali o storiche, la dashboard mostra zero senza
inventare risultati. Se la migrazione non è applicata, la dashboard segnala
esplicitamente persistenza degradata.
