import { Router } from "express";
import * as orderController from "../controllers/order.controller";

const router = Router();

router.post("/", orderController.create);
router.get("/:code", orderController.getByCode);
router.post("/:code/retry", orderController.retry);

export default router;
