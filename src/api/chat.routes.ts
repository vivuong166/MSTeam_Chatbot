import { Router } from "express";
import { handleChat } from "./chat.controller";

export const chatRouter = Router();

chatRouter.post("/chat", handleChat);
