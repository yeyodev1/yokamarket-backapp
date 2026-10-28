import { Router } from "express";
import * as orderController from "../controllers/order.controller";

const router = Router();

// El front llama a esto desde /pay-response con ?id= y ?clientTransactionId=.
router.post("/confirm", orderController.confirm);
router.post("/cancel", orderController.cancel);

export default router;
