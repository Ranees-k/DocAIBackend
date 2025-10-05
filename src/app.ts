import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes";
import fileRoutes from "./routes/fileRoutes";
import queryRoutes from "./routes/queryRoutes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON limit for Render
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Increase URL encoded limit

// Increase timeout for Render free tier
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes timeout
  res.setTimeout(300000); // 5 minutes timeout
  next();
});

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
