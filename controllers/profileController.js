// controllers/profileController.js
import pool from "../config/db.js";

/* ================= GET PROFILE ================= */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // 🔥 JOIN users + vendors (IMPORTANT FIX)
    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        v.business_name,
        v.phone,
        v.shop_address,
        v.upi_id
      FROM users u
      LEFT JOIN vendors v
      ON u.id = v.user_id
      WHERE u.id = $1
      `,
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // ✅ vendor → full data
    if (user.role === "vendor") {
      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        business_name: user.business_name,
        phone: user.phone,
        shop_address: user.shop_address,
        upi_id: user.upi_id
      });
    }

    // 👤 customer → basic data only
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Failed to fetch profile"
    });
  }
};


/* ================= UPDATE PROFILE ================= */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    // 👉 vendor fields
    const {
      business_name,
      phone,
      shop_address,
      upi_id
    } = req.body;

    // ✅ only vendor can update
    if (role === "vendor") {

      await pool.query(
        `
        UPDATE vendors
        SET business_name=$1,
            phone=$2,
            shop_address=$3,
            upi_id=$4
        WHERE user_id=$5
        `,
        [business_name, phone, shop_address, upi_id, userId]
      );

      return res.json({
        message: "Vendor profile updated"
      });
    }

    // 👤 customer → no update (address handled separately)
    return res.json({
      message: "Nothing to update for customer"
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Update failed"
    });
  }
};