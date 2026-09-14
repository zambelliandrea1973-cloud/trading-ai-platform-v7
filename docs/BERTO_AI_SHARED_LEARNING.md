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

## Modalità iniziale prevista

Dopo una prima fase demo:
- BERTO potrà operare LIVE solo quando i suoi parametri di ingaggio saranno definiti e approvati.
- Il motore AI continuerà in SHADOW/DEMO sugli stessi dati e timestamp.
- Le decisioni dei due sistemi saranno confrontate senza consentire modifiche reciproche automatiche.
- Un eventuale sistema HYBRID resterà inizialmente solo sperimentale/paper.

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
- modalità LIVE/PAPER/SHADOW
- strategia che ha generato il trade
- BUY/SELL
- size
- eventuale blocco del rischio
- motivazione del blocco o mancata esecuzione

### Esito
Ogni decisione viene monitorata ai checkpoint standard:
- 15 minuti
- 1 ora
- 4 ore
- 1 giorno
- chiusura effettiva o simulata dell'operazione

Per ogni checkpoint vengono salvati:
- prezzo del segnale
- prezzo di mercato al checkpoint
- prezzo entrata/uscita quando applicabile
- P&L
- P&L %
- MFE (Maximum Favorable Excursion)
- MAE (Maximum Adverse Excursion)
- stato trade chiuso/aperto
- WIN/LOSS/FLAT/NOT_TRADED

La chiusura del trade resta la misura principale dell'esito operativo; i checkpoint intermedi servono a valutare qualità dell'ingresso, gestione e timing dell'uscita.

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

## Human Approval Gate obbligatorio

Nessuna proposta può entrare in produzione automaticamente.

Prima di chiedere autorizzazione al proprietario, il sistema deve mostrare in modo verificabile e comprensibile:
- numero di casi analizzati
- periodo temporale coperto
- asset e timeframe interessati
- regime di mercato interessato
- rendimento baseline e candidato
- win rate baseline e candidato
- profit factor baseline e candidato
- expectancy baseline e candidato
- drawdown baseline e candidato
- numero di trade out-of-sample
- numero di trade paper, quando disponibile
- fonti/riferimenti dei dati usati
- spiegazione in linguaggio semplice di cosa cambia e perché

Il proprietario può scegliere esclusivamente una delle seguenti decisioni:
- APPROVA
- RIFIUTA
- CONTINUA A TESTARE

L'autorizzazione deve essere esplicita e registrata. Una proposta non approvata dal proprietario non può modificare BERTO, i pesi AI o la logica live.

## Regole di sicurezza dell'apprendimento

Pipeline obbligatoria:

`RESEARCH → BACKTEST → WALK_FORWARD → PAPER → APPROVAZIONE PROPRIETARIO → APPROVED`

Baseline iniziale:
- almeno 300 casi per una proposta significativa
- almeno 75 trade out-of-sample
- walk-forward obbligatorio
- paper validation obbligatoria
- spiegazione comprensibile obbligatoria
- revisione dei dati da parte del proprietario obbligatoria
- approvazione esplicita del proprietario obbligatoria
- self-modification live vietata

Queste soglie sono configurabili e dovranno essere rivalutate quando avremo dati reali sufficienti, ma il requisito di autorizzazione umana resta obbligatorio.

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
- outcome con checkpoint standard
- record di memoria condivisa
- modalità LIVE/PAPER/SHADOW
- classificazione consensus/divergence
- schema delle proposte di peso
- metriche verificabili per la proposta
- Human Approval Gate
- funzioni APPROVE / REJECT / CONTINUE_TESTING
- policy di validazione
- blocco della modifica live automatica

## Prossimi passi quando arrivano i parametri BERTO

1. Inserire e versionare il ruleset BERTO.
2. Collegare BERTO e AI allo stesso feed e allo stesso timestamp.
3. Persistire i SharedLearningRecord nel database.
4. Registrare anche WAIT/NO_TRADE e trade bloccati dal rischio.
5. Calcolare outcome a 15m, 1h, 4h, 1d e fino alla chiusura del trade.
6. Avviare confronto indipendente BERTO vs AI vs CONSENSUS.
7. Solo dopo campione sufficiente, generare proposte di adattamento.
8. Validare ogni proposta fuori campione e in paper.
9. Presentare al proprietario dati, fonti e spiegazione comprensibile.
10. Applicare una modifica solo dopo autorizzazione esplicita del proprietario.
