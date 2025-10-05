import express, { Router } from "express";
import { uploadFile, getDocumentStatus } from "../controllers/uploadFileController";
import { getAvailableStrategies } from "../config/chunkingConfig";
import { upload } from "../middleware/uploadMiddleware";

const router: Router = Router();

router.post("/upload", upload.single("file"), uploadFile);
router.get("/status/:docId", getDocumentStatus);

// Get available chunking strategies
router.get("/chunking-strategies", (req, res) => {
  try {
    const fileType = req.query.fileType as string;
    const strategies = getAvailableStrategies(fileType);
    
    res.json({
      success: true,
      strategies: strategies.map(strategy => ({
        name: strategy.name,
        description: strategy.description,
        fileTypes: strategy.fileTypes,
        options: strategy.options
      })),
      total: strategies.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;