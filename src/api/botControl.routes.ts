import { Router } from "express";
import {
  getBotControlStatus,
  recordManualTranscript,
  updateBotControlStatus
} from "./botControl.controller";

export const botControlRouter = Router();

botControlRouter.get("/bot-control/status", getBotControlStatus);
botControlRouter.post("/bot-control/status", updateBotControlStatus);
botControlRouter.post("/bot-control/transcript", recordManualTranscript);
