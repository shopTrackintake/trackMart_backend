import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


/* ================= REGISTER USER / VENDOR ================= */

export const register = async (req, res) => {

  try {

   const {
name,
email,
password,
role,
business_name,
phone,
shop_address,
upi_id
} = req.body;

    /* CHECK EMAIL ALREADY EXISTS */

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (existingUser.rows.length) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    /* HASH PASSWORD */

    const hashedPassword = await bcrypt.hash(password, 10);

    /* CREATE USER */

    const user = await pool.query(
      `
      INSERT INTO users (name,email,password_hash,role)
      VALUES ($1,$2,$3,$4)
      RETURNING id,role
      `,
      [name, email, hashedPassword, role]
    );

    const userId = user.rows[0].id;

    /* IF ROLE = VENDOR → CREATE VENDOR PROFILE */

   if (role === "vendor") {

  await pool.query(
`
INSERT INTO vendors
(user_id,business_name,phone,shop_address,upi_id,kyc_status)
VALUES ($1,$2,$3,$4,$5,'pending')
`,
[userId,business_name,phone,shop_address,upi_id]
);

  /* GET ADMIN */

  const admin = await pool.query(
    "SELECT id FROM users WHERE role='admin' LIMIT 1"
  );

  const adminId = admin.rows[0].id;

  /* SEND NOTIFICATION */

  await pool.query(
  `
  INSERT INTO notifications(user_id,title,message,type)
  VALUES($1,$2,$3,$4)
  `,
  [
  adminId,
  "New Vendor Registration",
  `${business_name} has registered. Please approve.`,
  "vendor_register"
  ]
  );

}

    res.json({
      message: "Registration successful"
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: err.message
    });

  }

};


/* ================= LOGIN ================= */

export const login = async (req, res) => {

  try {

    const { email, password } = req.body;

    /* FIND USER */

    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!user.rows.length) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    const userData = user.rows[0];

    /* CHECK PASSWORD */

    const validPassword = await bcrypt.compare(
      password,
      userData.password_hash
    );

    if (!validPassword) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    /* VENDOR APPROVAL CHECK */

    if (userData.role === "vendor") {

      const vendor = await pool.query(
        "SELECT kyc_status FROM vendors WHERE user_id=$1",
        [userData.id]
      );

      if (
        vendor.rows.length &&
        vendor.rows[0].kyc_status !== "approved"
      ) {
        return res.status(403).json({
          message: "Your vendor account is pending approval"
        });
      }

    }

    /* CREATE TOKEN */

    const token = jwt.sign(
      {
        id: userData.id,
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: userData.id,
        name: userData.name,
        role: userData.role
      }
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: err.message
    });

  }

};