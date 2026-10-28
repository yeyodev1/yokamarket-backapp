import { Request, Response } from "express";
import * as catalogService from "../services/catalog.service";

export async function getCatalog(_req: Request, res: Response) {
  res.json(await catalogService.getCatalog());
}

export async function getProduct(req: Request, res: Response) {
  res.json(await catalogService.getProductBySlug(String(req.params.slug)));
}

// Admin
export async function listProducts(_req: Request, res: Response) {
  res.json(await catalogService.listAllProducts());
}
export async function createProduct(req: Request, res: Response) {
  res.status(201).json(await catalogService.createProduct(req.body || {}));
}
export async function updateProduct(req: Request, res: Response) {
  res.json(await catalogService.updateProduct(String(req.params.id), req.body || {}));
}
export async function deleteProduct(req: Request, res: Response) {
  await catalogService.deleteProduct(String(req.params.id));
  res.status(204).end();
}
export async function listCategories(_req: Request, res: Response) {
  res.json(await catalogService.listAllCategories());
}
export async function createCategory(req: Request, res: Response) {
  res.status(201).json(await catalogService.createCategory(req.body || {}));
}
export async function updateCategory(req: Request, res: Response) {
  res.json(await catalogService.updateCategory(String(req.params.id), req.body || {}));
}
export async function deleteCategory(req: Request, res: Response) {
  await catalogService.deleteCategory(String(req.params.id));
  res.status(204).end();
}
