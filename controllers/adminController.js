import pool from "../config/db.js";
export const getAllVendors = async (req,res)=>{

try{

const vendors = await pool.query(`
SELECT 
v.id,
v.business_name,
v.kyc_status,
u.name,
u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE v.kyc_status = 'approved'
ORDER BY v.created_at DESC
`);

res.json(vendors.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
/* ================= DASHBOARD STATS ================= */

export const getAdminStats = async (req,res)=>{
try{

const vendors = await pool.query(
"SELECT COUNT(*) FROM vendors"
);

const pending = await pool.query(
"SELECT COUNT(*) FROM vendors WHERE kyc_status='pending'"
);

const revenue = await pool.query(
`
SELECT COALESCE(SUM(commission_amount),0) as total
FROM order_items
`
);

res.json({
vendors:Number(vendors.rows[0].count),
pending:Number(pending.rows[0].count),
revenue:Number(revenue.rows[0].total)
});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}
};


/* ================= GET PENDING VENDORS ================= */

export const getPendingVendors = async (req,res)=>{
try{

const vendors = await pool.query(
`
SELECT 
v.id,
v.business_name,
v.kyc_status,
u.name,
u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE v.kyc_status IN ('pending','hold')
ORDER BY v.created_at DESC
`
);

res.json(vendors.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}
};


/* ================= APPROVE VENDOR ================= */
export const approveVendor = async (req,res)=>{
try{

const { vendorId } = req.params;

/* GET USER ID */

const vendor = await pool.query(
"SELECT user_id,business_name FROM vendors WHERE id=$1",
[vendorId]
);

if(!vendor.rows.length){
return res.status(404).json({message:"Vendor not found"});
}

const userId = vendor.rows[0].user_id;
const businessName = vendor.rows[0].business_name;

/* APPROVE VENDOR */

await pool.query(
"UPDATE vendors SET kyc_status='approved' WHERE id=$1",
[vendorId]
);

/* SEND NOTIFICATION */

await pool.query(
`
INSERT INTO notifications
(user_id,title,message,type)
VALUES($1,$2,$3,$4)
`,
[
userId,
"Vendor Approved",
`🎉 Congratulations! Your vendor account "${businessName}" has been approved by admin.`,
"vendor"
]
);

res.json({message:"Vendor approved and notification sent"});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}
};


/* ================= HOLD VENDOR ================= */

export const holdVendor = async (req,res)=>{
try{

const { vendorId } = req.params;

await pool.query(
"UPDATE vendors SET kyc_status='hold' WHERE id=$1",
[vendorId]
);

res.json({message:"Vendor on hold"});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}
};


/* ================= DELETE VENDOR ================= */
export const deleteVendor = async (req, res) => {
try{

const { vendorId } = req.params;

/* get user id */

const vendor = await pool.query(
"SELECT user_id FROM vendors WHERE id=$1",
[vendorId]
);

if(!vendor.rows.length){
return res.status(404).json({message:"Vendor not found"});
}

const userId = vendor.rows[0].user_id;

/* delete products */

await pool.query(
"DELETE FROM products WHERE vendor_id=$1",
[vendorId]
);

/* delete vendor */

await pool.query(
"DELETE FROM vendors WHERE id=$1",
[vendorId]
);

/* delete user */

await pool.query(
"DELETE FROM users WHERE id=$1",
[userId]
);

res.json({ message: "Vendor deleted successfully" });

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}
};
export const getAdminProducts = async (req,res)=>{

try{

const products = await pool.query(
`
SELECT
p.*,
v.business_name
FROM products p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.status = 'active'
ORDER BY v.business_name, p.created_at DESC
`
);

res.json(products.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const deleteAdminProduct = async (req,res)=>{

try{

const { id } = req.params;
const { reason } = req.body;

/* GET PRODUCT + VENDOR USER */

const product = await pool.query(
`
SELECT 
p.title,
v.user_id
FROM products p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.id=$1
`,
[id]
);

if(!product.rows.length){
return res.status(404).json({message:"Product not found"});
}

const productTitle = product.rows[0].title;
const vendorUserId = product.rows[0].user_id;


/* DELETE PRODUCT */

await pool.query(
"UPDATE products SET status='inactive' WHERE id=$1",
[id]
);


/* SEND NOTIFICATION TO VENDOR */

await pool.query(
`
INSERT INTO notifications
(user_id,title,message,type)
VALUES ($1,$2,$3,$4)
`,
[
vendorUserId,
"Product Removed by Admin",
reason
? `Your product "${productTitle}" was removed. Reason: ${reason}`
: `Your product "${productTitle}" was removed by admin.`,
"product"
]
);

res.json({message:"Product deleted and vendor notified"});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const getAdminProductDetails = async (req,res)=>{

try{

const { id } = req.params;

const product = await pool.query(
`
SELECT 
p.id,
p.title,
p.description,
p.price,
p.stock,
p.size,
p.category_id,
p.image_url,
p.ingredients_image_url,
p.ingredients,
p.calories,
p.sugar,
p.fat,
p.protein,
p.how_to_use,
p.making_process,
p.delivery_charge,
p.status,
p.created_at,
c.name AS category_name,
c.benefits,
v.business_name
FROM products p
JOIN vendors v ON p.vendor_id = v.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.id = $1
`,
[id]
);

res.json(product.rows[0]);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const getAdminOrders = async (req,res)=>{

try{

const orders = await pool.query(`
SELECT
o.id AS order_id,
o.order_status,
o.created_at,
v.business_name,
p.title AS product_name,
oi.quantity,
oi.price_at_purchase
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN vendors v ON oi.vendor_id = v.id
LEFT JOIN products p ON oi.product_id = p.id;
`);

res.json(orders.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const getVendorWeeklyEarnings = async (req,res)=>{

try{

const data = await pool.query(`
SELECT
v.id as vendor_id,
v.business_name,
COALESCE(SUM(oi.vendor_earning),0) as total_earning
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN vendors v ON oi.vendor_id = v.id
WHERE
o.order_status='delivered'
AND oi.payout_status='pending'
GROUP BY v.id
`);

res.json(data.rows);

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}

};
export const clearVendorPayment = async (req,res)=>{

try{

const { vendorId } = req.params;

await pool.query(`
UPDATE order_items oi
SET payout_status='paid'
FROM orders o
WHERE oi.order_id=o.id
AND oi.vendor_id=$1
AND oi.payout_status='pending'
AND o.order_status='delivered'
`,[vendorId]);

res.json({message:"Weekly payout cleared"});

}catch(err){
console.log(err);
res.status(500).json({message:err.message});
}

};
export const getVendorDetails = async (req,res)=>{

try{

const { id } = req.params;

const vendor = await pool.query(
`
SELECT
v.id,
v.business_name,
v.phone,
v.shop_address,
v.upi_id,
v.kyc_status,
u.name,
u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE v.id=$1
`,
[id]
);

res.json(vendor.rows[0]);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
