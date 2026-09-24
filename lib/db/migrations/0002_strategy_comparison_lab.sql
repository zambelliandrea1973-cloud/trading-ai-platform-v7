CREATE TABLE IF NOT EXISTS "strategy_comparison_trades" (
  "user_id" text NOT NULL,
  "experiment_id" text DEFAULT 'five-vs-berto-v1' NOT NULL,
  "strategy" text NOT NULL,
  "external_trade_id" text NOT NULL,
  "symbol" text NOT NULL,
  "initial_capital" numeric(18, 2) NOT NULL,
  "opened_at" timestamptz NOT NULL,
  "closed_at" timestamptz NOT NULL,
  "net_pnl" numeric(18, 4) NOT NULL,
  "risk_amount" numeric(18, 4) NOT NULL,
  "fees" numeric(18, 4) DEFAULT '0' NOT NULL,
  "slippage" numeric(18, 4) DEFAULT '0' NOT NULL,
  "exit_reason" text NOT NULL,
  "source_snapshot" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "strategy_comparison_trades_pk"
    PRIMARY KEY ("user_id", "experiment_id", "strategy", "external_trade_id"),
  CONSTRAINT "strategy_comparison_trades_strategy_valid"
    CHECK ("strategy" IN ('FIVE_BRAINS_STRATEGY', 'BERTO_GOLDEN_SETUP')),
  CONSTRAINT "strategy_comparison_trades_values_valid"
    CHECK (
      "initial_capital" > 0
      AND "risk_amount" >= 0
      AND "fees" >= 0
      AND "slippage" >= 0
      AND "closed_at" >= "opened_at"
    )
);

CREATE INDEX IF NOT EXISTS "strategy_comparison_trades_lookup_idx"
  ON "strategy_comparison_trades" ("user_id", "experiment_id", "closed_at");
