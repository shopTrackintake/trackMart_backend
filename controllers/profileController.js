// controllers/profileController.js
import pool from "../config/db.js";
import bcrypt from "bcryptjs";

/* ================= GET PROFILE ================= */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // JOIN users + vendors
    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone as user_phone,
        u.role,
        v.id as vendor_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.shop_address,
        v.pincode,
        v.bank_holder_name,
        v.bank_account_number,
        v.bank_ifsc,
        v.upi_id,
        v.pan_number,
        v.gst_number,
        v.fssai_number,
        v.kyc_status
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

    // vendor → full profile data
    if (user.role === "vendor") {
      return res.json({
        id: user.id,
        vendor_id: user.vendor_id,
        name: user.name,
        email: user.email,
        role: user.role,
        business_name: user.business_name,
        owner_name: user.owner_name || user.name,
        phone: user.phone,
        shop_address: user.shop_address,
        pincode: user.pincode,
        bank_holder_name: user.bank_holder_name,
        bank_account_number: user.bank_account_number,
        bank_ifsc: user.bank_ifsc,
        upi_id: user.upi_id,
        pan_number: user.pan_number,
        gst_number: user.gst_number,
        fssai_number: user.fssai_number,
        kyc_status: user.kyc_status
      });
    }

    // customer → basic profile data
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.user_phone,
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

    // vendor update
    if (role === "vendor") {
      const {
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

      // Update users table name
      if (owner_name) {
        await pool.query(
          "UPDATE users SET name=$1 WHERE id=$2",
          [owner_name, userId]
        );
      }

      // Update vendors table
      await pool.query(
        `
        UPDATE vendors
        SET business_name=$1,
            owner_name=$2,
            phone=$3,
            shop_address=$4,
            pincode=$5,
            bank_holder_name=$6,
            bank_account_number=$7,
            bank_ifsc=$8,
            upi_id=$9,
            pan_number=$10,
            gst_number=$11,
            fssai_number=$12
        WHERE user_id=$13
        `,
        [
          business_name,
          owner_name,
          phone,
          shop_address,
          pincode,
          bank_holder_name,
          bank_account_number,
          bank_ifsc,
          upi_id,
          pan_number,
          gst_number,
          fssai_number,
          userId
        ]
      );

      return res.json({
        message: "Vendor profile and banking details updated successfully"
      });
    }

    // customer update (name, phone)
    const { name, phone } = req.body;
    if (name || phone) {
      if (name && phone) {
        await pool.query("UPDATE users SET name=$1, phone=$2 WHERE id=$3", [name, phone, userId]);
      } else if (name) {
        await pool.query("UPDATE users SET name=$1 WHERE id=$2", [name, userId]);
      } else if (phone) {
        await pool.query("UPDATE users SET phone=$1 WHERE id=$2", [phone, userId]);
      }
      return res.json({ message: "Profile updated successfully" });
    }

    return res.json({
      message: "Profile updated"
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Update failed: " + err.message
    });
  }
};

/* ================= CHANGE PASSWORD ================= */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Both current password and new password are required."
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long."
      });
    }

    // Retrieve existing hashed password
    const userRes = await pool.query("SELECT password_hash FROM users WHERE id=$1", [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password." });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hashedNew, userId]);

    return res.json({ message: "Password updated successfully!" });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({
      message: "Failed to change password: " + err.message
    });
  }
};