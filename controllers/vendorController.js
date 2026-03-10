import pool from "../config/db.js";


export const getVendorStats = async (req, res) => {
  try {

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const products = await pool.query(
      "SELECT COUNT(*) FROM products WHERE vendor_id=$1",
      [vendorId]
    );

    const orders = await pool.query(
      "SELECT COUNT(*) FROM order_items WHERE vendor_id=$1",
      [vendorId]
    );

    const earnings = await pool.query(
      "SELECT COALESCE(SUM(vendor_earning),0) FROM order_items WHERE vendor_id=$1",
      [vendorId]
    );

    res.json({
      products: Number(products.rows[0].count),
      orders: Number(orders.rows[0].count),
      earnings: Number(earnings.rows[0].coalesce)
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};



export const getVendorOrders = async (req, res) => {

  try {

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendorId = vendor.rows[0].id;

    const orders = await pool.query(
      `SELECT 
        o.id AS order_id,
        o.order_status,
        o.created_at,
        oi.quantity,
        oi.vendor_earning,
        p.title AS product_title
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.vendor_id = $1
      ORDER BY o.created_at DESC`,
      [vendorId]
    );

    res.json(orders.rows);

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};



export const getVendorEarnings = async (req, res) => {

  const vendor = await pool.query(
    "SELECT id FROM vendors WHERE user_id=$1",
    [req.user.id]
  );

  const vendorId = vendor.rows[0].id;

  const earnings = await pool.query(
    `SELECT
      SUM(vendor_earning) as total
     FROM order_items
     WHERE vendor_id=$1`,
    [vendorId]
  );

  const orders = await pool.query(
    `SELECT 
      oi.*,
      p.title as product_title
     FROM order_items oi
     JOIN products p ON p.id=oi.product_id
     WHERE oi.vendor_id=$1`,
    [vendorId]
  );

  res.json({
    total: earnings.rows[0].total || 0,
    orders: orders.rows
  });
};



/* ================= GET ORDER DETAILS ================= */

export const getVendorOrderDetails = async (req,res)=>{

try{

const { id } = req.params;

const order = await pool.query(
`
SELECT 
o.id,
o.order_status,
o.delivery_date,
o.user_id,
u.name AS customer_name,
u.id AS customer_id,
a.phone,
a.house_no,
a.street,
a.locality,
a.city,
a.state,
a.pincode
FROM orders o
JOIN users u ON o.user_id=u.id
JOIN addresses a ON o.address_id=a.id
WHERE o.id=$1
`,
[id]
);

const items = await pool.query(
`
SELECT 
oi.id,
oi.quantity,
oi.price_at_purchase,
p.title
FROM order_items oi
JOIN products p ON oi.product_id=p.id
WHERE oi.order_id=$1
`,
[id]
);

res.json({
order: order.rows[0],
items: items.rows
});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};



/* ================= CONFIRM ORDER ================= */

export const confirmVendorOrder = async (req,res)=>{

try{

const { id } = req.params;
const { delivery_date } = req.body;

const today = new Date().toISOString().split("T")[0];

if(delivery_date < today){
return res.status(400).json({
message:"Delivery date cannot be in the past"
});
}

/* UPDATE ORDER */

await pool.query(
`
UPDATE orders
SET order_status='confirmed',
delivery_date=$1
WHERE id=$2
`,
[delivery_date,id]
);

/* GET USER */

const orderUser = await pool.query(
"SELECT user_id FROM orders WHERE id=$1",
[id]
);

const userId = orderUser.rows[0].user_id;

/* NOTIFICATION */

await pool.query(
`
INSERT INTO notifications (user_id,title,message,type)
VALUES ($1,$2,$3,$4)
`,
[
userId,
"Order Confirmed",
"Vendor confirmed your order",
"order"
]
);

const updated = await pool.query(
`SELECT * FROM orders WHERE id=$1`,
[id]
);

res.json({
message:"Order confirmed",
order: updated.rows[0]
});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};



/* ================= MARK DELIVERED ================= */
export const markOrderDelivered = async (req,res)=>{

try{

const { id } = req.params;

const orderCheck = await pool.query(
`SELECT payment_method,user_id FROM orders WHERE id=$1`,
[id]
);

const paymentMethod = orderCheck.rows[0].payment_method;
const userId = orderCheck.rows[0].user_id;


/* COD → PAYMENT PAID */

if(paymentMethod === "COD"){

await pool.query(
`
UPDATE orders
SET 
order_status='delivered',
payment_status='paid',
delivered_at=NOW()
WHERE id=$1
`,
[id]
);

}

/* ONLINE → ONLY DELIVERED */

else{

await pool.query(
`
UPDATE orders
SET 
order_status='delivered',
delivered_at=NOW()
WHERE id=$1
`,
[id]
);

}


/* NOTIFICATION */

await pool.query(
`
INSERT INTO notifications (user_id,title,message,type)
VALUES ($1,$2,$3,$4)
`,
[
userId,
"Order Delivered",
"Your order has been delivered successfully",
"order"
]
);

const updated = await pool.query(
`SELECT * FROM orders WHERE id=$1`,
[id]
);

res.json({
message:"Order delivered",
order: updated.rows[0]
});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const getVendorPayments = async (req,res)=>{

try{

const vendor = await pool.query(
"SELECT id FROM vendors WHERE user_id=$1",
[req.user.id]
);

if(!vendor.rows.length){
return res.status(404).json({message:"Vendor not found"});
}

const vendorId = vendor.rows[0].id;

/* TOTAL RECEIVED */

const received = await pool.query(
`
SELECT COALESCE(SUM(vendor_earning),0) as total
FROM order_items
WHERE vendor_id=$1
AND payout_status='paid'
`,
[vendorId]
);

/* TOTAL PENDING */

const pending = await pool.query(
`
SELECT COALESCE(SUM(vendor_earning),0) as total
FROM order_items
WHERE vendor_id=$1
AND payout_status='pending'
`,
[vendorId]
);

/* PAYMENT HISTORY */

const history = await pool.query(
`
SELECT
oi.vendor_earning,
oi.payout_status,
o.created_at,
p.title as product_title
FROM order_items oi
JOIN orders o ON oi.order_id=o.id
LEFT JOIN products p ON oi.product_id=p.id
WHERE oi.vendor_id=$1
ORDER BY o.created_at DESC
`,
[vendorId]
);

res.json({
received: received.rows[0].total,
pending: pending.rows[0].total,
history: history.rows
});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};