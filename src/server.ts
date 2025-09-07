import app from "./app.ts";
import dotenv from "dotenv";
import cors from "cors";


dotenv.config();

const PORT = process.env.PORT || 5001;

// Add error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.use(cors({
  origin: "http://localhost:4800",  // 👈 must match exactly
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
}).on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});
