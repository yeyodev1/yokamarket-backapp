import { Request, Response } from "express";
import * as orderService from "../services/order.service";

export async function create(req: Request, res: Response) {
  res.status(201).json(await orderService.createOrder(req.body));
}

export async function getByCode(req: Request, res: Response) {
  res.json(await orderService.getOrderByCode(String(req.params.code)));
}

export async function retry(req: Request, res: Response) {
  res.json(await orderService.retryPayment(String(req.params.code)));
}

export async function confirm(req: Request, res: Response) {
  res.json(await orderService.confirmPayment(req.body));
}

export async function cancel(req: Request, res: Response) {
  res.json(await orderService.cancelPayment(req.body));
}

// Admin
export async function list(req: Request, res: Response) {
  res.json(await orderService.listOrders(req.query));
}
export async function getAdmin(req: Request, res: Response) {
  res.json(await orderService.getOrderAdmin(String(req.params.id)));
}
export async function updateStatus(req: Request, res: Response) {
  res.json(await orderService.updateOrderStatus(String(req.params.id), req.body || {}));
}
export async function updateNotes(req: Request, res: Response) {
  res.json(await orderService.updateOrderNotes(String(req.params.id), req.body || {}));
}
export async function stats(_req: Request, res: Response) {
  res.json(await orderService.stats());
}
