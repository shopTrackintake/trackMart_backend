import pool from "../config/db.js";

export const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM categories ORDER BY name ASC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error("CATEGORY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};