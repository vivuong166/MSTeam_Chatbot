import express from "express";
import dotenv from "dotenv";
dotenv.config();

import { handleChat } from "./bot/handler";


const app = express();
app.use(express.json());

app.post("/chat", handleChat);

app.listen(3000, () => {
  console.log("Server running...");
});