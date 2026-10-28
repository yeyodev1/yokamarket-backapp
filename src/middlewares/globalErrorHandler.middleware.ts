import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { env } from "../config/env";

export function globalErrorHandler(error: any, _req: Request, res: Response, _next: NextFunction) {
  // Índice único de Mongo: es un 409 del cliente, no un 500 nuestro.
  if (error?.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || "campo";
    res.status(409).json({ message: `Ya existe un registro con ese ${field}` });
    return;
  }

  if (error?.message === "Not allowed by CORS") {
    res.status(403).json({ message: "Origen no permitido por CORS" });
    return;
  }

  if (error?.name === "ValidationError") {
    const first = Object.values<any>(error.errors || {})[0];
    res.status(400).json({ message: first?.message || "Datos inválidos" });
    return;
  }

  if (error?.name === "MulterError") {
    res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? "La foto pesa más de 10 MB" : "No se pudo leer la foto" });
    return;
  }

  if (error?.name === "CastError") {
    res.status(400).json({ message: "Identificador inválido" });
    return;
  }

  const status = error.status || 500;
  // Un CustomError con 502/503 (Payphone caído, pagos sin configurar) lleva un
  // mensaje pensado para el cliente; solo el 500 genérico se oculta.
  const message = status === 500 ? "Error interno del servidor" : error.message || "Error";

  console.error(`[${status}] ${error.message || message}`, error.details || "");

  if (env.SLACK_ERROR_WEBHOOK && status >= 500) {
    axios
      .post(env.SLACK_ERROR_WEBHOOK, {
        text: `:rotating_light: *YOKA Market API ${status}*\n>${error.message}\n\`\`\`${JSON.stringify(error.details || error.stack || "", null, 2).slice(0, 2500)}\`\`\``,
      })
      .catch(() => {});
  }

  res.status(status).json({ message });
}
