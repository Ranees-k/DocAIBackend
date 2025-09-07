import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import nodemailer from "nodemailer";

// Email transporter (using Gmail for demo)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "raneeskalariyullathil@gmail.com",
    pass: "jfbw vhjo hnqw lkgz", // use Gmail App Password
  },
});

// ----------------- SIGNUP -----------------
export const signup = async (req: any, res: any) => {
  try {
    const { email, password, name } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    // check if user exists
    const existing = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    if (existing.rows.length) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert as inactive user
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, hashedPassword, false]
    );

    const newUser = result.rows[0];

    // create activation token
    const token = jwt.sign({ email }, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    // send activation email
    const link = `http://localhost:4800/activate/${token}`;
    await transporter.sendMail({
      from: '"MyApp" <your-email@gmail.com>',
      to: email,
      subject: "Activate your account",
      html: `<h3>Hello ${name},</h3>
             <p>Thanks for signing up! Please click the link below to activate your account:</p>
             <a href="${link}">${link}</a>`,
    });

    res.json({
      message: "Signup successful! Check your email to activate.",
      userId: newUser.id,
    });
  } catch (err: any) {
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
