// src/routes/queryRoutes.ts
import { Router } from "express";
import { queryDocument, getRateLimitStatus } from "../controllers/queryController.ts";
import { rateLimiter } from "../middleware/rateLimiter.ts";

const router = Router();

// Apply rate limiting to query endpoint
router.post("/query", rateLimiter, queryDocument);

// Get rate limit status
router.get("/rate-limit", getRateLimitStatus);

export default router;
