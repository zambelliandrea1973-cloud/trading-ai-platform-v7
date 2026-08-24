import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradingRouter from "./trading";
import brokerRouter from "./broker";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tradingRouter);
router.use(brokerRouter);

export default router;
