import express from "express";
import { aiRouter } from "./api/ai.routes";
import { botControlRouter } from "./api/botControl.routes";
import { errorHandler } from "./middleware/errorHandler";
import path from "path";

export const app = express();

app.use(express.json());
app.use("/sidebar", express.static(path.resolve(process.cwd(), "public")));
app.use(botControlRouter);
app.use(aiRouter);
app.use(errorHandler);
