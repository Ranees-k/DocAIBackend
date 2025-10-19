import { Router } from "express";
import { signup, login, resendActivationEmail, forgetPassword, resetPassword } from "../controllers/authController";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../config/db.js";

const router: Router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/resend-activation", resendActivationEmail);
router.post("/forget-password", forgetPassword);
router.post("/reset-password", resetPassword);

// URL-based password reset route (better UX for email links)
router.post("/reset-password/:token", async (req: any, res: any) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: "Password is required" 
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        error: "Password must be at least 6 characters" 
      });
    }

    console.log(`🔄 Processing URL-based password reset with token`);

    // Verify the reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      email: string;
      type: string;
    };

    // Check if it's a password reset token
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ 
        error: "Invalid reset token" 
      });
    }

    // Get database client with timeout
    let client;
    try {
      client = await pool.connect();
      await client.query('SET statement_timeout = 10000');

      // Check if user exists
      const user = await client.query("SELECT * FROM users WHERE email=$1", [decoded.email]);
      if (!user.rows.length) {
        return res.status(400).json({ 
          error: "User not found" 
        });
      }

      const userData = user.rows[0];

      // Check if user is active
      if (!userData.active) {
        return res.status(400).json({ 
          error: "Account is not activated" 
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log(`🔐 New password hashed for: ${decoded.email}`);

      // Update password in database
      await client.query(
        "UPDATE users SET password_hash=$1 WHERE email=$2",
        [hashedPassword, decoded.email]
      );

      console.log(`✅ Password updated successfully for: ${decoded.email}`);

      res.json({
        message: "Password updated successfully! You can now log in with your new password.",
        success: true
      });

    } catch (err: any) {
      console.error("❌ URL-based reset password error:", err);
      
      // Handle specific database errors
      if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
        return res.status(408).json({ 
          error: "Request timeout. Please try again." 
        });
      }
      
      if (err.code === 'ECONNREFUSED' || err.message.includes('Connection terminated')) {
        return res.status(503).json({ 
          error: "Service temporarily unavailable. Please try again later." 
        });
      }

      res.status(500).json({ 
        error: "Internal server error. Please try again later.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } finally {
      if (client) {
        client.release();
      }
    }

  } catch (err: any) {
    console.error("❌ URL-based reset password error:", err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ 
        error: "Reset token has expired. Please request a new one." 
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({ 
        error: "Invalid reset token" 
      });
    }

    res.status(500).json({ 
      error: "Internal server error. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

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
