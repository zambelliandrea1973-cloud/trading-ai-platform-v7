import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { refreshAxiRules } from "./lib/axiRulesSentinel";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Axi Select engagement parameters are checked periodically against trusted primary/support pages.
// Auto-activation occurs only when at least two sources agree; conflicts keep the last verified rules.
if (process.env.NODE_ENV !== "test" && process.env.AXI_SENTINEL_ENABLED !== "false") {
  const runSentinel = () => refreshAxiRules().then((result) => {
    if (result.status === "UPDATED") logger.warn({ changes: result.changes }, "Axi Select rules updated automatically");
    if (result.status === "CONFLICT" || result.status === "DEGRADED") logger.warn({ status: result.status }, "Axi Select sentinel could not safely update rules");
  }).catch((error) => logger.warn({ error }, "Axi Select sentinel refresh failed"));

  const startupTimer = setTimeout(runSentinel, 30_000);
  startupTimer.unref?.();
  const sentinelTimer = setInterval(runSentinel, 6 * 60 * 60 * 1000);
  sentinelTimer.unref?.();
}

export default app;
