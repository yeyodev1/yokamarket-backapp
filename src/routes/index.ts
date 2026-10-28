import { Express, Router } from "express";
import catalogRoutes from "./catalog.routes";
import orderRoutes from "./order.routes";
import paymentRoutes from "./payment.routes";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import * as settingsController from "../controllers/settings.controller";

export default function routerApi(app: Express) {
  const router = Router();
  app.use("/api", router);

  router.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  router.get("/settings", settingsController.getPublic);
  router.use("/catalog", catalogRoutes);
  router.use("/orders", orderRoutes);
  router.use("/payments", paymentRoutes);
  router.use("/auth", authRoutes);
  router.use("/admin", adminRoutes);

  router.use((_req, res) => res.status(404).json({ message: "Ruta no encontrada" }));
}
