import { Router } from "express";
import { signup, login } from "../controllers/authController.ts";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const router: Router = Router();

router.post("/signup", signup);
router.post("/login", login);

router.get("/activate/:token", async (req, res) => {
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
