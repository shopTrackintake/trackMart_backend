import pool from "../config/db.js";

/* ADD TO WISHLIST */
export const addToWishlist = async (req, res) => {
  try {

    const userId = req.user.id;
    const { product_id } = req.body;

    const result = await pool.query(
      `INSERT INTO wishlist (user_id, product_id)
       VALUES ($1,$2)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING *`,
      [userId, product_id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

/* GET WISHLIST */
export const getWishlist = async (req, res) => {

  try {

    const userId = req.user.id;

    const items = await pool.query(
      `SELECT
        p.*,
        w.id as wishlist_id
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = $1`,
      [userId]
    );

    res.json(items.rows);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }

};

/* REMOVE FROM WISHLIST */
export const removeFromWishlist = async (req, res) => {

  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM wishlist WHERE id=$1",
      [id]
    );

    res.json({ message: "Removed from wishlist" });

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};