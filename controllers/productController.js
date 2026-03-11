import pool from "../config/db.js";

/* ================= GET ALL PRODUCTS ================= */

export const getProducts = async (req, res) => {
  try {

    const products = await pool.query(
      `SELECT 
        p.*,
        c.name AS category_name,
         c.benefits,
        v.business_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN vendors v ON p.vendor_id = v.id
       WHERE p.status='active'
       ORDER BY p.created_at DESC`
    );

    res.json(products.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= CREATE PRODUCT ================= */

export const createProduct = async (req, res) => {
  try {

    if (req.user.role !== "vendor") {
      return res.status(403).json({ message:"Only vendors allowed" });
    }

    const {
      title,
      description,
      price,
      stock,
      size,
      category_id,
      calories,
      sugar,
      fat,
      protein,
      ingredients,
       how_to_use = null,
  making_process = null,
      delivery_charge
    } = req.body;

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    const parsedCalories = Number(calories);
    const parsedSugar = Number(sugar);
    const parsedSize = Number(size);
    const parsedFat = Number(fat);
    const parsedProtein = Number(protein);
    const parsedDelivery = Number(delivery_charge || 0);

    let health_rating = "Healthy";

    if (
      parsedSugar > 20 ||
      parsedFat > 20 ||
      parsedCalories > 500
    ) {
      health_rating = "Unhealthy";
    }

    const vendor = await pool.query(
      "SELECT id,business_name FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(400).json({
        message:"Vendor profile missing"
      });
    }

    const vendor_id = vendor.rows[0].id;
    const vendorName = vendor.rows[0].business_name;

   const product_image =
  req.files?.product_image?.[0]?.path || null;

const ingredients_image =
  req.files?.ingredients_image?.[0]?.path || null;

    const product = await pool.query(
      `INSERT INTO products
      (vendor_id,category_id,title,description,
       price,stock,size,delivery_charge,
       calories,sugar,fat,protein,
       ingredients,health_rating,how_to_use,making_process,
       image_url,ingredients_image_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        vendor_id,
        category_id,
        title,
        description,
        parsedPrice,
        parsedStock,
        parsedSize,
        parsedDelivery,
        parsedCalories,
        parsedSugar,
        how_to_use,
making_process,
        parsedFat,
        parsedProtein,
        ingredients,
        health_rating,
        product_image,
        ingredients_image
      ]
    );


    /* ================= ADMIN NOTIFICATION ================= */

    const admins = await pool.query(
      "SELECT id FROM users WHERE role='admin'"
    );

    for(const admin of admins.rows){

      await pool.query(
        `
        INSERT INTO notifications
        (user_id,title,message,type)
        VALUES($1,$2,$3,$4)
        `,
        [
          admin.id,
          "New Product Added",
          `${title} was added by vendor ${vendorName}`,
          "product"
        ]
      );

    }


    res.json(product.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


/* ================= GET VENDOR PRODUCTS ================= */
export const getVendorProducts = async (req, res) => {

 try{

  const vendor = await pool.query(
   "SELECT id FROM vendors WHERE user_id=$1",
   [req.user.id]
  );

  if(!vendor.rows.length){
   return res.status(400).json({message:"Vendor not found"});
  }

  const vendorId = vendor.rows[0].id;

  const products = await pool.query(
   `
   SELECT *
   FROM products
   WHERE vendor_id=$1
   AND status='active'
   ORDER BY created_at DESC
   `,
   [vendorId]
  );

  res.json(products.rows);

 }catch(err){

  console.log(err);
  res.status(500).json({message:err.message});

 }

};


/* ================= DELETE PRODUCT ================= */
export const deleteProduct = async (req,res)=>{

try{

const { id } = req.params;

await pool.query(
"UPDATE products SET status='inactive' WHERE id=$1",
[id]
);

res.json({message:"Product removed from store"});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
