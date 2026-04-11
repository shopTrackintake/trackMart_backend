import pool from "../config/db.js";

/* ================= GET TRACKING ================= */

export const getItemTracking = async (req, res) => {
  try {
    const { itemId } = req.params;

    //  validation
    if (!itemId) {
      return res.status(400).json({ message: "Item ID required" });
    }

    const result = await pool.query(
      `
      SELECT 
        oi.id AS item_id,
        oi.item_status,
        oi.delivery_date,
        oi.latitude,
    oi.longitude,
        oi.vendor_id,

        o.user_id,
      
        p.title,
        v.business_name AS vendor_name

      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      JOIN vendors v ON v.id = oi.vendor_id
      WHERE oi.id = $1
      `,
      [itemId]
    );

    //  not found
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    const data = result.rows[0];

    // 🔐 ACCESS CONTROL
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // user access
    if (user.role === "user" && data.user_id !== user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // vendor access
    if (user.role === "vendor") {

      const vendor = await pool.query(
        "SELECT id FROM vendors WHERE user_id=$1",
        [user.id]
      );

      if (!vendor.rows.length) {
        return res.status(403).json({ message: "Vendor not found" });
      }

      const vendorId = vendor.rows[0].id;

      if (data.vendor_id !== vendorId) {
        return res.status(403).json({ message: "Not allowed" });
      }
    }

    // FINAL RESPONSE
    return res.json({
      item_id: data.item_id,
      status: data.item_status,
      delivery_date: data.delivery_date,
      vendor_name: data.vendor_name,
      title: data.title,

      // 🚚 delivery boy location
      latitude: data.latitude,
      longitude: data.longitude,

      // 🏠 user location (for route)
      user_lat: data.user_lat,
      user_lng: data.user_lng
    });

  } catch (err) {
    console.error("TRACK ERROR:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};



/* ================= UPDATE LOCATION ================= */

export const updateLocation = async (req, res) => {
  try {
    const { item_id, lat, lng } = req.body;

    if (!item_id || !lat || !lng) {
      return res.status(400).json({ message: "Missing data" });
    }

    await pool.query(
      `
      UPDATE order_items
      SET latitude = $1,
          longitude = $2
      WHERE id = $3
      `,
      [lat, lng, item_id]
    );

    res.json({ message: "Location updated" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};