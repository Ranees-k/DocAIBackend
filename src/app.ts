import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

import authRoutes from "./routes/authRoutes.ts";
import fileRoutes from "./routes/fileRoutes.ts";
import queryRoutes from "./routes/queryRoutes.ts";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Routes
app.use("/auth", authRoutes);
app.use("/file", fileRoutes);
app.use("/query", queryRoutes);
// app.use("/documents", fileRoutes);

app.get("/", (req, res) => {
  res.send("🚀 DocAI Backend is running (TypeScript)");
});

export default app;
