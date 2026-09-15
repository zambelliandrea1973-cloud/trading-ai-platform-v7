# Roadmap operativa — 5 cervelli + contesto istituzionale

## Decisione architetturale

COT, stagionalità, fair value e regime macro non sono nuovi cervelli. Sono feature dei cervelli esistenti:
- Macro/News: regime macro ed eventi;
- Fundamental: fair value specifico per asset class;
- Statistical: stagionalità e stabilità dell'effetto;
- Risk/Safety: freschezza, qualità, conflitti e veto dati;
- Technical: rimane basato sul prezzo, senza contaminazione look-ahead.

Il modulo `institutionalContext.ts` è inizialmente solo SHADOW. Nessun aumento di size e nessuna modifica BUY/SELL fino alla validazione out-of-sample.

## Fonti ammesse

| Priorità | Fonte | Uso | Chiave | Frequenza |
|---|---|---|---|---|
| P0 | CFTC Public Reporting Environment / COT | posizionamento istituzionale | no | settimanale, dopo pubblicazione |
| P0 | MT5/AXI storico OHLC | stagionalità e risultati | credenziali bridge esistenti | giornaliera |
| P0 | FRED/ALFRED | tassi, inflazione, crescita, rendimenti; vintage point-in-time | sì | per release |
| P0 | ECB Data Portal API | tassi e macro area euro | no/da verificare sul deployment | per release |
| P1 | EIA Open Data API | petrolio, gas, scorte | sì; bulk senza chiave | settimanale/giornaliera |
| P1 | BLS/BEA/Fed/ECB calendari ufficiali | conferma eventi e release | dipende dalla fonte | giornaliera |
| P2 | BBC/CNBC RSS | contesto narrativo, mai dato economico ufficiale | no | continua |

Non usare il “Salotto” come feed: è una fonte interpretativa. Le idee sono trasformate in variabili, ma i dati devono provenire dalle fonti primarie.

## Azioni dell'utente

### Fase 1 — prerequisiti
1. Creare una chiave FRED dedicata all'app: https://fred.stlouisfed.org/docs/api/api_key.html
2. Creare una chiave EIA: https://www.eia.gov/opendata/register.php
3. In Replit Secrets aggiungere `FRED_API_KEY` e `EIA_API_KEY`. Non inserirle in GitHub.
4. Confermare i simboli AXI/MT5 iniziali (consigliato: EURUSD, GBPUSD, USDJPY, XAUUSD, USOIL/WTI, principali indici).
5. Confermare il timezone operativo e la mappatura simbolo broker -> mercato CFTC.

### Fase 2 — connettori
6. Implementare downloader CFTC con dataset e campi espliciti per asset; salvare reporting date e release timestamp.
7. Implementare FRED/ALFRED usando vintage/realtime date per evitare look-ahead.
8. Implementare ECB ed EIA con retry, rate limit, checksum e cache.
9. Usare MT5 per OHLC corretto per timezone, rollover e buchi; calcolare stagionalità senza dati futuri.
10. Creare tabella `external_observations`: provider, series, instrument, observed_at, released_at, vintage_at, fetched_at, value, checksum, status.

### Fase 3 — motori
11. COT: net, delta settimanale, percentili 52 settimane e 5 anni, normalizzati per open interest.
12. Stagionalità: media, mediana, positive rate, dispersione, sample size, MAE e similarità di regime.
13. Fair value: modelli separati per FX, commodity, indici e azioni; sempre intervallo d'incertezza.
14. Macro regime: risk-on/off, inflationary/disinflationary, tightening/easing; nessun ordine diretto.
15. Collegare il risultato al Master Engine solo come output shadow e persisterlo con ogni decisione.

### Fase 4 — validazione
16. Confrontare: BERTO vs 5 cervelli attuale vs 5 cervelli + contesto istituzionale.
17. Stesso feed, timestamp, spread, slippage e universo strumenti.
18. Walk-forward e out-of-sample; vietato ottimizzare sul periodo di valutazione.
19. Metriche minime: expectancy netta, profit factor, max drawdown, MAE/MFE, copertura e stabilità per regime.
20. Promozione solo con campione sufficiente definito prima del test, nessun peggioramento materiale del drawdown e miglioramento stabile dopo costi.

### Fase 5 — attivazione controllata
21. Prima promozione: usare il layer soltanto per trasformare trade in WAIT o ridurre size.
22. Mai aumentare size sulla sola convergenza.
23. Canary su pochi strumenti e limite di rischio più basso.
24. Kill switch, rollback e dashboard di freschezza/fonti.
25. Solo dopo nuova validazione permettere un peso decisionale, con versionamento dei pesi.

## Variabili ambiente previste

```
INSTITUTIONAL_CONTEXT_MODE=shadow
FRED_API_KEY=
EIA_API_KEY=
CFTC_DATASET_TFF=
CFTC_DATASET_DISAGGREGATED=
PRIMARY_DATA_MAX_AGE_HOURS=72
COT_MAX_AGE_HOURS=192
```

## Definition of Done

- ogni valore ha provider, release time, vintage e checksum;
- un dato stale/invalid non entra nel punteggio;
- test unitari e test di contratto con fixture congelate;
- nessuna regressione su Master Engine;
- persistenza delle tre strategie e dei checkpoint;
- report shadow riproducibile prima di qualunque promozione.


## Modalità operative e protezione interferenze

- `SCALP`: M1/M5, durata massima 15 minuti, rischio iniziale 0,20%, spread massimo 1,35x, slippage massimo 0,08R.
- `INTRADAY`: M5/M15/M30/H1, chiusura entro 12 ore, rischio iniziale 0,35%.
- `SWING`: H1/H4/D1, durata massima 7 giorni, rischio iniziale 0,50%.
- ogni strategia può essere `OFF`, `DEMO` o `LIVE`;
- `LIVE` rimane bloccato finché campione, approvazione esperimento, MT5, execution flag e persistenza non risultano tutti validi;
- il primo motore che acquisisce un simbolo ottiene un lock esclusivo globale;
- gli altri motori continuano l'analisi shadow ma non possono inviare ordini;
- il lock si libera soltanto dopo conferma di chiusura dal broker;
- ogni lock possiede una scadenza di sicurezza, ma la scadenza non autorizza automaticamente un nuovo ordine: serve riconciliazione MT5.

### Passaggi deployment

1. In Replit eseguire `pnpm --filter @workspace/db push` per creare `strategy_modes` e `instrument_locks`.
2. Eseguire `pnpm run typecheck`.
3. Eseguire `pnpm --filter @workspace/api-server test`.
4. Pubblicare inizialmente con `LIVE_EXECUTION_ENABLED=false`.
5. Verificare il pannello **Modalità operative** e provare OFF/DEMO.
6. Simulare due acquisizioni contemporanee dello stesso simbolo e confermare che una riceva HTTP 409.
7. Collegare la creazione/chiusura ordini del bridge agli endpoint lock.
8. Solo dopo i criteri sperimentali, revisione umana e audit completo valutare `LIVE_EXECUTION_ENABLED=true`.
