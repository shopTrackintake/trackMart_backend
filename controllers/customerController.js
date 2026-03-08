import pool from "../config/db.js";



export const getCustomerStats = async (req,res)=>{

try{

const userId = req.user.id;

/* TOTAL ORDERS */

const totalOrders = await pool.query(`
SELECT COUNT(*) 
FROM orders
WHERE user_id=$1
`,[userId]);

/* HEALTHY */

const healthy = await pool.query(`
SELECT COUNT(*)
FROM order_items oi
JOIN orders o ON oi.order_id=o.id
JOIN products p ON oi.product_id=p.id
WHERE o.user_id=$1
AND LOWER(p.health_rating)='healthy'
`,[userId]);

/* UNHEALTHY */

const unhealthy = await pool.query(`
SELECT COUNT(*)
FROM order_items oi
JOIN orders o ON oi.order_id=o.id
JOIN products p ON oi.product_id=p.id
WHERE o.user_id=$1
AND LOWER(p.health_rating)='unhealthy'
`,[userId]);

/* RECENT ORDERS */

const recentOrders = await pool.query(`
SELECT
p.title,
o.total_amount,
oi.quantity,
o.created_at
FROM order_items oi
JOIN orders o ON oi.order_id=o.id
JOIN products p ON oi.product_id=p.id
WHERE o.user_id=$1
ORDER BY o.created_at DESC
LIMIT 5
`,[userId]);

res.json({
totalOrders:Number(totalOrders.rows[0].count),
healthy:Number(healthy.rows[0].count),
unhealthy:Number(unhealthy.rows[0].count),
recent:recentOrders.rows
});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};