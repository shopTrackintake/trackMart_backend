import pool from "../config/db.js";

/* ================= GET PRODUCTS ================= */

export const getProducts = async (req, res) => {

  try {

    const { search, category, care, concern, price, sort } = req.query;

    let query = `
      SELECT 
        p.*,
        c.name AS category_name,
        c.benefits AS benefits,
        v.business_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.status='active'
    `;

    const values = [];
    let index = 1;

    /* SEARCH */

    if (search) {

      query += `
        AND (
          p.title ILIKE $${index}
          OR p.description ILIKE $${index}
          OR p.care_type ILIKE $${index}
          OR p.concern_type ILIKE $${index}
        )
      `;

      values.push(`%${search}%`);
      index++;

    }

    /* CATEGORY */

    if (category) {

      query += ` AND p.category_id = $${index}`;
      values.push(category);
      index++;

    }

    /* CARE */

    if (care) {

      query += ` AND p.care_type ILIKE $${index}`;
      values.push(`%${care}%`);
      index++;

    }

    /* CONCERN */

    if (concern) {

      query += ` AND p.concern_type ILIKE $${index}`;
      values.push(`%${concern}%`);
      index++;

    }

    /* PRICE */

    if (price) {

      query += ` AND p.price <= $${index}`;
      values.push(price);
      index++;

    }

    /* SORT */

    if (sort === "price_low") {
      query += ` ORDER BY p.price ASC`;
    }
    else if (sort === "price_high") {
      query += ` ORDER BY p.price DESC`;
    }
    else {
      query += ` ORDER BY p.created_at DESC`;
    }

    const products = await pool.query(query, values);

    res.json(products.rows);

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};


/* ================= CREATE PRODUCT ================= */

export const createProduct = async (req, res) => {

  try {

    if (req.user.role !== "vendor") {
      return res.status(403).json({ message: "Only vendors allowed" });
    }

    const {
      title,
      description,
      price,
      stock,
      size,
      category_id,
      calories,
      care_type,
      concern_type,
      sugar,
      fat,
      protein,
      ingredients,
      how_to_use = null,
      making_process = null
    } = req.body;

    /* REQUIRED VALIDATION */

    if (!title || !price || !stock || !size) {
      return res.status(400).json({
        message: "Required fields missing"
      });
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    const parsedCalories = calories ? Number(calories) : null;
    const parsedSugar = sugar ? Number(sugar) : null;
    const parsedFat = fat ? Number(fat) : null;
    const parsedProtein = protein ? Number(protein) : null;
    const parsedSize = size;

    /* HEALTH RATING */

    let health_rating = "Healthy";

    if (
      (parsedSugar && parsedSugar > 20) ||
      (parsedFat && parsedFat > 20) ||
      (parsedCalories && parsedCalories > 500)
    ) {
      health_rating = "Unhealthy";
    }

    /* GET VENDOR */

    const vendor = await pool.query(
      "SELECT id,business_name FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(400).json({
        message: "Vendor profile missing"
      });
    }

    const vendor_id = vendor.rows[0].id;
    const vendorName = vendor.rows[0].business_name;

    /* IMAGE PATHS */

    const product_image =
      req.files?.product_image?.[0]?.path || null;

    const ingredients_image =
      req.files?.ingredients_image?.[0]?.path || null;

    /* INSERT PRODUCT */

    const product = await pool.query(
      `
      INSERT INTO products
      (vendor_id,category_id,title,description,
      price,stock,size,
      calories,sugar,fat,protein,
      care_type,concern_type,
      ingredients,health_rating,
      how_to_use,making_process,
      image_url,ingredients_image_url)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
      `,
      [
        vendor_id,
        category_id,
        title,
        description,
        parsedPrice,
        parsedStock,
        parsedSize,
      
        parsedCalories,
        parsedSugar,
        parsedFat,
        parsedProtein,
        care_type,
        concern_type,
        ingredients,
        health_rating,
        how_to_use,
        making_process,
        product_image,
        ingredients_image
      ]
    );

    /* ================= ADMIN NOTIFICATION ================= */

    const admins = await pool.query(
      "SELECT id FROM users WHERE role='admin'"
    );

    for (const admin of admins.rows) {

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

  try {

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(400).json({ message: "Vendor not found" });
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

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};


/* ================= DELETE PRODUCT ================= */

export const deleteProduct = async (req, res) => {

  try {

    const { id } = req.params;

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const vendorId = vendor.rows[0].id;

    await pool.query(
      "UPDATE products SET status='inactive' WHERE id=$1 AND vendor_id=$2",
      [id, vendorId]
    );

    res.json({ message: "Product removed from store" });

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};