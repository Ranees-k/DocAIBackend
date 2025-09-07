import express, { Router } from "express";
import multer from "multer";
import { uploadFile } from "../controllers/uploadFileController.ts";

const router: Router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), uploadFile);

export default router;