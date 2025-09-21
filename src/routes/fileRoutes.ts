import express, { Router } from "express";
import multer from "multer";
import { uploadFile } from "../controllers/uploadFileController";
import { getAvailableStrategies } from "../config/chunkingConfig";

const router: Router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), uploadFile);

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