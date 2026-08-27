import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradingRouter from "./trading";
import brokerRouter from "./broker";
import fundamentalsRouter from "./fundamentals";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(tradingRouter);
router.use(fundamentalsRouter);
router.use(brokerRouter);

export default router;
