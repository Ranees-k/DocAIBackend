import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes";
import fileRoutes from "./routes/fileRoutes";
import queryRoutes from "./routes/queryRoutes";

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
