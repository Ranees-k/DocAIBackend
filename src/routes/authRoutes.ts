import { Router } from "express";
import { signup, login, resendActivationEmail, forgetPassword, resetPassword } from "../controllers/authController";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const router: Router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/resend-activation", resendActivationEmail);
router.post("/forget-password", forgetPassword);
router.post("/reset-password", resetPassword);

// Test endpoint for database connectivity
router.get("/test-db", async (req: any, res: any) => {
  let client;
  try {
    console.log("🔄 Testing database connection...");
    client = await pool.connect();
    await client.query('SELECT NOW() as current_time');
    res.json({ 
      success: true, 
      message: "Database connection successful",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("❌ Database test failed:", err);
    res.status(500).json({ 
      success: false, 
      error: "Database connection failed",
      details: err.message 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get("/activate/:token", async (req: any, res: any) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      email: string;
    };

    // activate user in DB
    const result = await pool.query(
      "UPDATE users SET active=true WHERE email=$1 RETURNING *",
      [decoded.email]
    );

    if (!result.rows.length) {
      return res.status(400).send("User not found");
    }

    const user = result.rows[0];
    return res.send(  
      {
        status: "success",
        message: `✅ Hi ${user.name}, your account is activated! You can now log in.`
      }
    );
  } catch (err) {
    res.status(400).send("❌ Invalid or expired activation link");
  }
});

export default router;
