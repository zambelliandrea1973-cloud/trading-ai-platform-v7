import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradingRouter from "./trading";
import brokerRouter, { mt5HeartbeatRouter } from "./broker";
import fundamentalsRouter from "./fundamentals";
import decisionRouter from "./decision";
import v72Router from "./v72";
import strategyControlRouter from "./strategy-control";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();

router.use(healthRouter);
// The bridge has no Clerk session. This one endpoint authenticates with its
// dedicated bridge key and IP allowlist inside the route.
router.use(mt5HeartbeatRouter);
router.use(requireAuth);
router.use(tradingRouter);
router.use(fundamentalsRouter);
router.use(decisionRouter);
router.use(v72Router);
router.use(strategyControlRouter);
router.use(brokerRouter);

export default router;
