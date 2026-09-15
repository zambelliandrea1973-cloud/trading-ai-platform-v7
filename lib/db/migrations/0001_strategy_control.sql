CREATE TABLE IF NOT EXISTS "user_risk_controls" (
  "user_id" text PRIMARY KEY NOT NULL,
  "max_risk_per_trade_pct" numeric(6, 3) DEFAULT '0.500' NOT NULL,
  "max_daily_loss_pct" numeric(6, 3) DEFAULT '2.000' NOT NULL,
  "max_open_exposure_pct" numeric(6, 3) DEFAULT '5.000' NOT NULL,
  "max_concurrent_positions" integer DEFAULT 3 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "user_risk_controls_positive" CHECK (
    "max_risk_per_trade_pct" > 0
    AND "max_daily_loss_pct" > 0
    AND "max_open_exposure_pct" > 0
    AND "max_concurrent_positions" > 0
  )
);

CREATE TABLE IF NOT EXISTS "strategy_modes" (
  "user_id" text NOT NULL,
  "strategy" text NOT NULL,
  "mode" text DEFAULT 'DEMO' NOT NULL,
  "experiment_passed" boolean DEFAULT false NOT NULL,
  "completed_samples" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "strategy_modes_pk" PRIMARY KEY ("user_id", "strategy"),
  CONSTRAINT "strategy_modes_strategy_valid" CHECK ("strategy" IN ('SCALP', 'INTRADAY', 'SWING')),
  CONSTRAINT "strategy_modes_mode_valid" CHECK ("mode" IN ('OFF', 'DEMO', 'LIVE'))
);

CREATE TABLE IF NOT EXISTS "instrument_locks" (
  "user_id" text NOT NULL,
  "canonical_symbol" text NOT NULL,
  "owner_strategy" text NOT NULL,
  "run_mode" text NOT NULL,
  "direction" text NOT NULL,
  "external_position_id" text,
  "status" text NOT NULL,
  "acquired_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "last_broker_confirmation_at" timestamptz,
  CONSTRAINT "instrument_locks_pk" PRIMARY KEY ("user_id", "canonical_symbol"),
  CONSTRAINT "instrument_locks_strategy_valid" CHECK ("owner_strategy" IN ('SCALP', 'INTRADAY', 'SWING')),
  CONSTRAINT "instrument_locks_mode_valid" CHECK ("run_mode" IN ('DEMO', 'LIVE')),
  CONSTRAINT "instrument_locks_direction_valid" CHECK ("direction" IN ('BUY', 'SELL')),
  CONSTRAINT "instrument_locks_status_valid" CHECK ("status" IN ('PENDING', 'OPEN', 'CLOSING'))
);