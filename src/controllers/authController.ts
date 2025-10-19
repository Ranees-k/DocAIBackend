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

    // create activation token
    const token = jwt.sign({ email }, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    // Try to send email first
    try {
      console.log(`📧 Attempting to send activation email to: ${email}`);
      await sendActivationEmailAsync(email, name, token);
      
      // Only insert user if email was sent successfully
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash, active, email_sent) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, email, hashedPassword, false, true]
      );

      const newUser = result.rows[0];
      console.log(`👤 User created with ID: ${newUser.id} after successful email send`);

      res.json({
        message: "Signup successful! Check your email to activate.",
        userId: newUser.id,
        emailSent: true
      });

    } catch (emailError: any) {
      console.error(`❌ Failed to send activation email to ${email}:`, emailError);
      
      // Don't save user if email fails
      res.status(500).json({ 
        error: "Failed to send activation email. Please try again.",
        details: emailError.message 
      });
    }

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

// ----------------- FORGET PASSWORD -----------------
export const forgetPassword = async (req: any, res: any) => {
  let client;
  
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    console.log(`🔄 Processing forget password request for: ${email}`);

    // Get database client with timeout
    client = await pool.connect();
    
    // Set query timeout
    await client.query('SET statement_timeout = 10000'); // 10 seconds
    
    // Check if user exists and is active
    const user = await client.query("SELECT * FROM users WHERE email=$1", [email]);
    
    if (!user.rows.length) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: "If the email exists, a password reset link has been sent.",
        emailSent: true
      });
    }

    const userData = user.rows[0];

    // Check if user is active
    if (!userData.active) {
      return res.status(400).json({ 
        error: "Please activate your account first before resetting password" 
      });
    }

    // Create password reset token
    const resetToken = jwt.sign(
      { email, type: 'password_reset' }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    console.log(`✅ Password reset token generated for: ${email}`);

    // Send immediate response for security
    res.json({
      message: "If the email exists, a password reset link has been sent.",
      emailSent: true
    });

    // Send password reset email asynchronously (don't await)
    setImmediate(() => {
      sendPasswordResetEmailAsync(email, userData.name, resetToken).catch(error => {
        console.error(`❌ Failed to send password reset email to ${email}:`, error);
      });
    });

  } catch (err: any) {
    console.error("❌ Forget password error:", err);
    
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
    // Always release the client
    if (client) {
      client.release();
    }
  }
};

// ----------------- RESET PASSWORD -----------------
export const resetPassword = async (req: any, res: any) => {
  let client;
  
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: "Token and new password are required" 
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "Password must be at least 6 characters" 
      });
    }

    console.log(`🔄 Processing password reset with token`);

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
    client = await pool.connect();
    
    // Set query timeout
    await client.query('SET statement_timeout = 10000'); // 10 seconds

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
    const hashedPassword = await bcrypt.hash(newPassword, 10);
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
    console.error("❌ Reset password error:", err);
    
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
  } finally {
    // Always release the client
    if (client) {
      client.release();
    }
  }
};

// Async function to send password reset email using SendGrid
async function sendPasswordResetEmailAsync(email: string, name: string, token: string): Promise<void> {
  try {
    console.log(`📧 Sending password reset email to: ${email}`);
    
    const resetLink = `https://docaibackend-41i1.onrender.com/auth/reset-password/${token}`;
    
    const msg = {
      to: email,
      from: 'raneeskalariyullathil@gmail.com', // Change to your verified sender
      subject: 'Reset your DocAI password',
      text: `Hello ${name}, You requested a password reset. Please click the link below to reset your password: ${resetLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
            Password Reset Request
          </h2>
          
          <p>Hello ${name},</p>
          <p>We received a request to reset your password for your DocAI account.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>If you requested this password reset:</strong></p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404;"><strong>Security Notice:</strong></p>
            <p style="margin: 5px 0 0 0; color: #856404;">If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          
          <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">${resetLink}</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>This email was sent from DocAI password reset system.</p>
            <p>For security reasons, this link will expire in 1 hour.</p>
          </div>
        </div>
      `,
    };
    
    await sgMail.send(msg);
    
    console.log(`✅ Password reset email sent successfully to: ${email}`);
    
  } catch (error: any) {
    console.error(`❌ Password reset email sending failed for ${email}:`, error);
    throw error;
  }
}