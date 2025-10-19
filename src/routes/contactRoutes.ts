import express from 'express';
import { submitContactForm } from '../controllers/contactController';

const router = express.Router();

// POST /contact - Submit contact form
router.post('/', submitContactForm);

export default router;

