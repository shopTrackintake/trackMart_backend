import pool from "../config/db.js";

/* ADD TO CART */
export const addToCart = async (req, res) => {
  const { product_id, quantity } = req.body;
  const userId = req.user.id;

  // Check existing item
  const existing = await pool.query(
    "SELECT quantity FROM carts WHERE user_id=$1 AND product_id=$2",
    [userId, product_id]
  );

  if (existing.rows.length > 0) {
    const newQty = existing.rows[0].quantity + quantity;

    if (newQty <= 0) {
      await pool.query(
        "DELETE FROM carts WHERE user_id=$1 AND product_id=$2",
        [userId, product_id]
      );
      return res.json({ message: "Item removed" });
    }

    await pool.query(
      "UPDATE carts SET quantity=$1 WHERE user_id=$2 AND product_id=$3",
      [newQty, userId, product_id]
    );

  } else {
    if (quantity > 0) {
      await pool.query(
        "INSERT INTO carts(user_id,product_id,quantity) VALUES($1,$2,$3)",
        [userId, product_id, quantity]
      );
    }
  }

  res.json({ message: "Cart updated" });
};

/* GET CART */
export const getCart = async (req, res) => {
  const cart = await pool.query(
    `SELECT p.*, c.quantity
     FROM carts c
     JOIN products p ON p.id=c.product_id
     WHERE c.user_id=$1`,
    [req.user.id]
  );

  res.json(cart.rows);
};