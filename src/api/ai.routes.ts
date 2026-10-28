import { Router } from "express";
import { handleAiReply } from "./ai.controller";

export const aiRouter = Router();

aiRouter.post("/ai/reply", handleAiReply);
