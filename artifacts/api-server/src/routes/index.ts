import { Router, type IRouter } from "express";
import healthRouter from "./health";
import planningRouter from "./planning";
import assistantRouter from "./assistant";
import examRouter from "./exam";

const router: IRouter = Router();

router.use(healthRouter);
router.use(planningRouter);
router.use(assistantRouter);
router.use(examRouter);

export default router;
