import { Request, Response } from "express";
import * as settingsService from "../services/settings.service";

export async function getPublic(_req: Request, res: Response) {
  res.json(settingsService.publicSettings(await settingsService.getSettings()));
}

export async function update(req: Request, res: Response) {
  res.json(settingsService.publicSettings(await settingsService.updateSettings(req.body || {})));
}
