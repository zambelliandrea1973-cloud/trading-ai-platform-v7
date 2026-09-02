# BERTO ↔ AI Shared Learning Architecture

## Obiettivo

Preparare una memoria comune che consenta a BERTO e al motore AI di confrontare i propri segnali, misurare gli esiti reali nel tempo e proporre miglioramenti dei pesi o delle condizioni operative senza modificare automaticamente la logica live.

La configurazione operativa BERTO resta volutamente incompleta finché non vengono forniti i parametri di ingaggio ufficiali.

## Principio di separazione

BERTO e AI devono rimanere due sistemi indipendenti in fase di generazione del segnale.

Flusso previsto:

`Dati di mercato → BERTO`  
`Dati di mercato → AI`  
`BERTO + AI → Memoria comune → Analisi risultati → Proposte di miglioramento`

Nessun sistema deve modificare direttamente l'altro durante l'operatività live.

## Cosa viene registrato per ogni osservazione

### Contesto di mercato
- simbolo
- asset class
- timeframe
- timestamp
- orizzonte operativo
- regime di mercato
- regime di volatilità
- spread
- ATR
- rischio evento
- fonte dati
- stato qualità dati
- feature tecniche/statistiche disponibili

### Output AI
- score e confidenza tecnica
- score e confidenza macro/news
- score e confidenza fondamentale
- score e confidenza statistica
- score/risk veto/size multiplier del livello rischio
- decisione master
- score master
- confidenza master

### Output BERTO
- configurato/non configurato
- versione regole
- decisione BUY/SELL/WAIT/NO_TRADE
- confidenza, se disponibile
- gruppi di regole soddisfatti
- versione parametri

### Relazione tra i due sistemi
Ogni caso viene classificato come:
- CONSENSUS: entrambi direzionali e concordi
- AI: AI direzionale, BERTO non direzionale
- BERTO: BERTO direzionale, AI non direzionale
- DIVERGENCE: segnali differenti o contrastanti

Il disaccordo viene conservato come informazione utile e non eliminato.

### Esecuzione
- trade eseguito o no
- BUY/SELL
- size
- eventuale blocco del rischio
- motivazione del blocco o mancata esecuzione

### Esito
Per uno o più orizzonti temporali:
- prezzo entrata/uscita
- P&L
- P&L %
- MFE (Maximum Favorable Excursion)
- MAE (Maximum Adverse Excursion)
- WIN/LOSS/FLAT/NOT_TRADED

## Apprendimento previsto

Il sistema deve poter analizzare segmenti separati per:
- asset
- asset class
- timeframe
- orizzonte
- regime di mercato
- regime di volatilità

Esempi di domande future:
- BERTO è più affidabile dell'AI su EUR/USD in regime laterale?
- Il cervello statistico migliora i risultati quando BERTO e tecnico sono in conflitto?
- In prossimità di eventi macro ad alto impatto, quanto cala l'affidabilità di BERTO?
- Il consenso BERTO+AI ha expectancy superiore ai segnali singoli?
- Quale sistema riduce meglio il drawdown nei diversi regimi?

## Pesi dinamici: solo come proposta

La memoria comune potrà generare proposte del tipo:

- aumento/riduzione fiducia BERTO
- variazione peso tecnico
- variazione peso macro/news
- variazione peso fondamentale
- variazione peso statistico

Le modifiche saranno specifiche per segmento e non globali per default.

## Regole di sicurezza dell'apprendimento

Una proposta non entra in produzione direttamente.

Pipeline obbligatoria:

`RESEARCH → BACKTEST → WALK_FORWARD → PAPER → APPROVED`

Baseline iniziale:
- almeno 300 casi per una proposta significativa
- almeno 75 trade out-of-sample
- walk-forward obbligatorio
- paper validation obbligatoria
- self-modification live vietata

Queste soglie sono configurabili e dovranno essere rivalutate quando avremo dati reali sufficienti.

## Parametri BERTO ancora mancanti

Il file `bertoStrategyEngine.ts` contiene già la struttura necessaria per ricevere:
- asset/simboli ammessi
- timeframe
- gruppi entry long
- gruppi entry short
- exit
- filtri
- risk per trade
- stop loss
- take profit
- max posizioni
- max perdita giornaliera
- limite spread

Finché i parametri di ingaggio non vengono forniti, BERTO deve rimanere disabilitato e produrre WAIT.

## Implementazione preparata

Il modulo `artifacts/api-server/src/lib/learningMemoryEngine.ts` definisce:
- snapshot AI
- snapshot BERTO
- contesto di mercato
- outcome
- record di memoria condivisa
- classificazione consensus/divergence
- schema delle proposte di peso
- policy di validazione
- blocco della modifica live automatica

## Prossimi passi quando arrivano i parametri BERTO

1. Inserire e versionare il ruleset BERTO.
2. Collegare BERTO e AI allo stesso feed e allo stesso timestamp.
3. Persistire i SharedLearningRecord nel database.
4. Registrare anche WAIT/NO_TRADE e trade bloccati dal rischio.
5. Calcolare outcome a più orizzonti temporali.
6. Avviare confronto indipendente BERTO vs AI vs CONSENSUS.
7. Solo dopo campione sufficiente, generare proposte di adattamento.
8. Validare ogni proposta fuori campione e in paper prima di qualsiasi promozione.
