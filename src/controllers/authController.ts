import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import sgMail from "@sendgrid/mail";

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// ----------------- SIGNUP -----------------
export const signup = async (req: any, res: any) => {
  try {
    const { email, password, name } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    console.log(`🔄 Starting signup process for: ${email}`);

    // check if user exists
    const existing = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    if (existing.rows.length) {
      return res.status(400).json({ error: "Email already registered" });
    }

    console.log(`✅ Email ${email} is available`);

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`🔐 Password hashed for: ${email}`);

    // insert as inactive user
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, hashedPassword, false]
    );

    const newUser = result.rows[0];
    console.log(`👤 User created with ID: ${newUser.id}`);

    // create activation token
    const token = jwt.sign({ email }, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    // Send immediate response to prevent timeout
    res.json({
      message: "Signup successful! Check your email to activate.",
      userId: newUser.id,
      emailSent: true
    });

    // Send activation email asynchronously to prevent timeout
    sendActivationEmailAsync(email, name, token).catch(error => {
      console.error(`❌ Failed to send activation email to ${email}:`, error);
      // Update user status to indicate email sending failed
      pool.query(
        "UPDATE users SET email_sent = false WHERE id = $1",
        [newUser.id]
      ).catch(dbError => {
        console.error("❌ Failed to update email status:", dbError);
      });
    });

  } catch (err: any) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Async function to send activation email using SendGrid
async function sendActivationEmailAsync(email: string, name: string, token: string): Promise<void> {
  try {
    console.log(`📧 Sending activation email to: ${email}`);
    
    const link = `https://doc-ai-fast.netlify.app/activate/${token}`;
    
    const msg = {
      to: email,
      from: 'raneeskalariyullathil@gmail.com', // Change to your verified sender
      subject: 'Activate your DocAI account',
      text: `Hello ${name}, Thanks for signing up! Please click the link below to activate your account: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to DocAI!</h2>
          <p>Hello ${name},</p>
          <p>Thanks for signing up! Please click the button below to activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Activate Account
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${link}</p>
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        </div>
      `,
    };
    
    await sgMail.send(msg);
    
    console.log(`✅ Activation email sent successfully to: ${email}`);
    
    // Update user status to indicate email was sent
    await pool.query(
      "UPDATE users SET email_sent = true WHERE email = $1",
      [email]
    );
    
  } catch (error: any) {
    console.error(`❌ Email sending failed for ${email}:`, error);
    throw error;
  }
}

// ----------------- RESEND ACTIVATION EMAIL -----------------
export const resendActivationEmail = async (req: any, res: any) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    console.log(`🔄 Resending activation email for: ${email}`);

    // Check if user exists
    const user = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!user.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user.rows[0];

    // Check if user is already active
    if (userData.active) {
      return res.status(400).json({ error: "Account is already activated" });
    }

    // Create new activation token
    const token = jwt.sign({ email }, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    // Send immediate response
    res.json({
      message: "Activation email sent! Check your inbox.",
      emailSent: true
    });

    // Send email asynchronously
    sendActivationEmailAsync(email, userData.name, token).catch(error => {
      console.error(`❌ Failed to resend activation email to ${email}:`, error);
    });

  } catch (err: any) {
    console.error("❌ Resend activation email error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------- LOGIN -----------------
export const login = async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!user.rows.length)
      return res.status(400).json({ error: "Invalid credentials" });

    if (!user.rows[0].active) {
      return res
        .status(403)
        .json({ error: "Please activate your account first" });
    }

    const valid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.rows[0].id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: { id: user.rows[0].id, email: user.rows[0].email },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};