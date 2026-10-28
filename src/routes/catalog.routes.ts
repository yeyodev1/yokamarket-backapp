import { Router } from "express";
import * as catalogController from "../controllers/catalog.controller";

const router = Router();

router.get("/", catalogController.getCatalog);
router.get("/products/:slug", catalogController.getProduct);

export default router;
