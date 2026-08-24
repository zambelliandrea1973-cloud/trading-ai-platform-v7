# VECTOR / AI

Piattaforma di trading assistito che rende leggibili segnali, news e contesto storico anche a un neofita, mantenendo l’esecuzione reale sotto controllo esplicito.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/trading-ai-platform` — interfaccia web e stato del sistema
- `artifacts/api-server` — API e adapter broker server-side
- `lib/api-spec/openapi.yaml` — contratto API source of truth
- `lib/db/src/schema` — schema PostgreSQL Drizzle
- `docs/mt5-bridge-protocol.md` — contratto operativo del bridge Axi/MT5

## Architecture decisions

- Il broker è un bridge MT5 esterno: il motore AI non dipende direttamente da Axi o dall’SDK del terminale.
- Il sistema parte in PAPER e l’esecuzione LIVE richiede una revisione e un’abilitazione separate.
- News live, storico delle news e comportamento passato degli asset dovranno alimentare analisi spiegabili su orizzonti breve, medio e lungo.

## Product

- Un assistente AI confronta segnali tecnici, notizie mondiali in tempo reale e database di eventi storici per confermare o smentire i trend.
- Le decisioni mostrano contesto, rischio, invalidazione e orizzonte temporale invece di presentare segnali come garanzie.
- Una futura automazione potrà operare su Axi Select solo entro limiti e parametri scelti dal trader e dopo validazione PAPER end-to-end.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
