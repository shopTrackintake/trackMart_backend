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
      owner_name,
      business_name,
      phone,
      shop_address,
      pincode,
      bank_holder_name,
      bank_account_number,
      bank_ifsc,
      upi_id,
      pan_number,
      gst_number,
      fssai_number
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
      [name || owner_name || "Vendor", email, hashedPassword, role]
    );

    const userId = user.rows[0].id;

    /* IF ROLE = VENDOR → CREATE VENDOR PROFILE */

   if (role === "vendor") {

  await pool.query(
`
INSERT INTO vendors
(user_id, business_name, owner_name, phone, shop_address, pincode,
 bank_holder_name, bank_account_number, bank_ifsc, upi_id,
 pan_number, gst_number, fssai_number, kyc_status)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
`,
[
  userId,
  business_name,
  owner_name || name,
  phone,
  shop_address,
  pincode,
  bank_holder_name,
  bank_account_number,
  bank_ifsc,
  upi_id,
  pan_number,
  gst_number,
  fssai_number
]
);

  /* GET ADMIN */

  const admin = await pool.query(
    "SELECT id FROM users WHERE role='admin' LIMIT 1"
  );

  const adminId = admin.rows[0]?.id;

  /* SEND NOTIFICATION */

  if (adminId) {
    await pool.query(
    `
    INSERT INTO notifications(user_id,title,message,type)
    VALUES($1,$2,$3,$4)
    `,
    [
    adminId,
    "New Vendor Registration",
    `${business_name} has registered with complete business & compliance details. Please review and approve.`,
    "vendor_register"
    ]
    );
  }

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