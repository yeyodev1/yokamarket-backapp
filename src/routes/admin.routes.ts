import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as orderController from "../controllers/order.controller";
import * as catalogController from "../controllers/catalog.controller";
import * as settingsController from "../controllers/settings.controller";

const router = Router();

router.use(authMiddleware);

router.get("/stats", orderController.stats);

router.get("/orders", orderController.list);
router.get("/orders/:id", orderController.getAdmin);
router.patch("/orders/:id/status", orderController.updateStatus);
router.patch("/orders/:id/notes", orderController.updateNotes);

router.get("/products", catalogController.listProducts);
router.post("/products", catalogController.createProduct);
router.patch("/products/:id", catalogController.updateProduct);
router.delete("/products/:id", catalogController.deleteProduct);

router.get("/categories", catalogController.listCategories);
router.post("/categories", catalogController.createCategory);
router.patch("/categories/:id", catalogController.updateCategory);
router.delete("/categories/:id", catalogController.deleteCategory);

router.patch("/settings", settingsController.update);

export default router;
