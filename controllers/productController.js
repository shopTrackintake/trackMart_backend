import pool from "../config/db.js";
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await pool.query(
      `
      SELECT 
        p.*,
        c.name AS category_name,
        c.benefits,
        v.business_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.id = $1 AND (p.status = 'active' OR p.status IS NULL OR p.status != 'inactive')
      `,
      [id]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product.rows[0]);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};
/* ================= GET PRODUCTS ================= */
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      care,
      concern,
      price,
      sort,
      page = 1,
      limit = 8
    } = req.query;

    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE (p.status = 'active' OR p.status IS NULL OR p.status != 'inactive')
    `;

    let values = [];
    let index = 1;

    /* FILTERS SAME AS YOUR CODE */

    if (search) {
      baseQuery += `
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

    if (category) {
      baseQuery += ` AND p.category_id = $${index}`;
      values.push(category);
      index++;
    }

    if (care) {
      baseQuery += ` AND p.care_type ILIKE $${index}`;
      values.push(`%${care}%`);
      index++;
    }

    if (concern) {
      baseQuery += ` AND p.concern_type ILIKE $${index}`;
      values.push(`%${concern}%`);
      index++;
    }

    if (price) {
      baseQuery += ` AND p.price <= $${index}`;
      values.push(price);
      index++;
    }

    /* SORT */
    let orderBy = `ORDER BY p.created_at DESC`;
    if (sort === "price_low") orderBy = `ORDER BY p.price ASC`;
    if (sort === "price_high") orderBy = `ORDER BY p.price DESC`;

    /* MAIN QUERY WITH LIMIT */
    const productsQuery = `
      SELECT 
        p.*,
        c.name AS category_name,
        c.benefits,
        v.business_name
      ${baseQuery}
      ${orderBy}
      LIMIT $${index} OFFSET $${index + 1}
   `;

    const products = await pool.query(productsQuery, [
      ...values,
      limit,
      offset
    ]);

    /* COUNT QUERY */
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    const totalResult = await pool.query(countQuery, values);

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      products: products.rows,
      totalPages: Math.ceil(total / limit)
    });

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
      discount_percent,
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
      making_process = null,
      brand_name = null,
      sku = null,
      barcode = null,
      serving_size = null,
      servings_per_container = null,
      net_weight = null,
      flavour = null,
      dietary_type = null,
      manufacturer_name = null,
      manufacturer_address = null,
      batch_number = null,
      mfg_date = null,
      expiry_date = null,
      fssai_license = null,
      nutrition_per_100g = null,
      nutrition_per_serving = null
    } = req.body;

    /* REQUIRED VALIDATION */

    if (!title || !price || !stock || !size) {
      return res.status(400).json({
        message: "Required fields missing (Title, Price, Stock, Size)"
      });
    }

    const parsedPrice = Number(price);
    const parsedDiscount = discount_percent ? Number(discount_percent) : 0;
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

    // CHECK DUPLICATE PRODUCT
    const existingProduct = await pool.query(
      `SELECT id FROM products 
       WHERE vendor_id=$1 
       AND LOWER(title)=LOWER($2)
       AND status='active'`,
      [vendor_id, title]
    );

    if (existingProduct.rows.length > 0) {
      return res.status(400).json({
        message: "Product already exists for this vendor"
      });
    }

    /* IMAGE PATHS */

    const product_image =
      req.files?.product_image?.[0]?.path || null;

    const ingredients_image =
      req.files?.ingredients_image?.[0]?.path || null;

    /* INSERT PRODUCT */

    const product = await pool.query(
      `
      INSERT INTO products
      (vendor_id, category_id, title, description,
       price, discount_percent, stock, size,
       calories, sugar, fat, protein,
       care_type, concern_type,
       ingredients, health_rating,
       how_to_use, making_process,
       image_url, ingredients_image_url,
       brand_name, sku, barcode,
       serving_size, servings_per_container, net_weight,
       flavour, dietary_type, manufacturer_name,
       manufacturer_address, batch_number, mfg_date,
       expiry_date, fssai_license, nutrition_per_100g,
       nutrition_per_serving)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
             $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
             $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
             $31,$32,$33,$34,$35,$36)
      RETURNING *
      `,
      [
        vendor_id,
        category_id || null,
        title,
        description,
        parsedPrice,
        parsedDiscount,
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
        ingredients_image,
        brand_name || null,
        sku || null,
        barcode || null,
        serving_size || null,
        servings_per_container || null,
        net_weight || null,
        flavour || null,
        dietary_type || null,
        manufacturer_name || null,
        manufacturer_address || null,
        batch_number || null,
        mfg_date || null,
        expiry_date || null,
        fssai_license || null,
        nutrition_per_100g || null,
        nutrition_per_serving || null
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


/* ================= UPDATE PRODUCT ================= */

export const updateProduct = async (req, res) => {
  try {
    if (req.user.role !== "vendor") {
      return res.status(403).json({ message: "Only vendors allowed" });
    }

    const { id } = req.params;

    const vendor = await pool.query(
      "SELECT id FROM vendors WHERE user_id=$1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(400).json({ message: "Vendor profile missing" });
    }

    const vendor_id = vendor.rows[0].id;

    const existing = await pool.query(
      "SELECT * FROM products WHERE id=$1 AND vendor_id=$2 AND (status = 'active' OR status IS NULL OR status != 'inactive')",
      [id, vendor_id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    const {
      title,
      description,
      price,
      discount_percent,
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
      how_to_use,
      making_process,
      brand_name,
      sku,
      barcode,
      serving_size,
      servings_per_container,
      net_weight,
      flavour,
      dietary_type,
      manufacturer_name,
      manufacturer_address,
      batch_number,
      mfg_date,
      expiry_date,
      fssai_license,
      nutrition_per_100g,
      nutrition_per_serving
    } = req.body;

    const parsedPrice = price !== undefined ? Number(price) : Number(existing.rows[0].price);
    const parsedDiscount = discount_percent !== undefined ? Number(discount_percent) : (existing.rows[0].discount_percent || 0);
    const parsedStock = stock !== undefined ? Number(stock) : Number(existing.rows[0].stock);
    const parsedCalories = calories !== undefined && calories !== "" ? Number(calories) : existing.rows[0].calories;
    const parsedSugar = sugar !== undefined && sugar !== "" ? Number(sugar) : existing.rows[0].sugar;
    const parsedFat = fat !== undefined && fat !== "" ? Number(fat) : existing.rows[0].fat;
    const parsedProtein = protein !== undefined && protein !== "" ? Number(protein) : existing.rows[0].protein;

    let health_rating = "Healthy";
    if (
      (parsedSugar && parsedSugar > 20) ||
      (parsedFat && parsedFat > 20) ||
      (parsedCalories && parsedCalories > 500)
    ) {
      health_rating = "Unhealthy";
    }

    const product_image =
      req.files?.product_image?.[0]?.path || existing.rows[0].image_url;

    const ingredients_image =
      req.files?.ingredients_image?.[0]?.path || existing.rows[0].ingredients_image_url;

    const updated = await pool.query(
      `
      UPDATE products
      SET title=$1,
          description=$2,
          price=$3,
          discount_percent=$4,
          stock=$5,
          size=$6,
          category_id=$7,
          calories=$8,
          sugar=$9,
          fat=$10,
          protein=$11,
          care_type=$12,
          concern_type=$13,
          ingredients=$14,
          health_rating=$15,
          how_to_use=$16,
          making_process=$17,
          image_url=$18,
          ingredients_image_url=$19,
          brand_name=$20,
          sku=$21,
          barcode=$22,
          serving_size=$23,
          servings_per_container=$24,
          net_weight=$25,
          flavour=$26,
          dietary_type=$27,
          manufacturer_name=$28,
          manufacturer_address=$29,
          batch_number=$30,
          mfg_date=$31,
          expiry_date=$32,
          fssai_license=$33,
          nutrition_per_100g=$34,
          nutrition_per_serving=$35
      WHERE id=$36 AND vendor_id=$37
      RETURNING *
      `,
      [
        title || existing.rows[0].title,
        description !== undefined ? description : existing.rows[0].description,
        parsedPrice,
        parsedDiscount,
        parsedStock,
        size || existing.rows[0].size,
        category_id || existing.rows[0].category_id,
        parsedCalories,
        parsedSugar,
        parsedFat,
        parsedProtein,
        care_type !== undefined ? care_type : existing.rows[0].care_type,
        concern_type !== undefined ? concern_type : existing.rows[0].concern_type,
        ingredients !== undefined ? ingredients : existing.rows[0].ingredients,
        health_rating,
        how_to_use !== undefined ? how_to_use : existing.rows[0].how_to_use,
        making_process !== undefined ? making_process : existing.rows[0].making_process,
        product_image,
        ingredients_image,
        brand_name !== undefined ? brand_name : existing.rows[0].brand_name,
        sku !== undefined ? sku : existing.rows[0].sku,
        barcode !== undefined ? barcode : existing.rows[0].barcode,
        serving_size !== undefined ? serving_size : existing.rows[0].serving_size,
        servings_per_container !== undefined ? servings_per_container : existing.rows[0].servings_per_container,
        net_weight !== undefined ? net_weight : existing.rows[0].net_weight,
        flavour !== undefined ? flavour : existing.rows[0].flavour,
        dietary_type !== undefined ? dietary_type : existing.rows[0].dietary_type,
        manufacturer_name !== undefined ? manufacturer_name : existing.rows[0].manufacturer_name,
        manufacturer_address !== undefined ? manufacturer_address : existing.rows[0].manufacturer_address,
        batch_number !== undefined ? batch_number : existing.rows[0].batch_number,
        mfg_date !== undefined && mfg_date !== "" ? mfg_date : existing.rows[0].mfg_date,
        expiry_date !== undefined && expiry_date !== "" ? expiry_date : existing.rows[0].expiry_date,
        fssai_license !== undefined ? fssai_license : existing.rows[0].fssai_license,
        nutrition_per_100g !== undefined ? nutrition_per_100g : existing.rows[0].nutrition_per_100g,
        nutrition_per_serving !== undefined ? nutrition_per_serving : existing.rows[0].nutrition_per_serving,
        id,
        vendor_id
      ]
    );

    res.json(updated.rows[0]);

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
      AND (status != 'deleted' OR status IS NULL)
      ORDER BY created_at DESC
      `,
      [vendorId]
    );

    res.json(products.rows);

  } catch (err) {

    console.log(err);
    if (err.code === "23505") {
      return res.status(400).json({
        message: "Duplicate product not allowed"
      });
    }

    res.status(500).json({ message: err.message });

  }

};

/* ================= TOGGLE PRODUCT STATUS (ACTIVATE / DEACTIVATE) ================= */

export const toggleProductStatus = async (req, res) => {
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

    const product = await pool.query(
      "SELECT id, title, status FROM products WHERE id=$1 AND vendor_id=$2",
      [id, vendorId]
    );

    if (!product.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const currentStatus = product.rows[0].status || "active";
    const newStatus = currentStatus === "inactive" ? "active" : "inactive";

    const updated = await pool.query(
      "UPDATE products SET status=$1 WHERE id=$2 AND vendor_id=$3 RETURNING *",
      [newStatus, id, vendorId]
    );

    res.json({
      message: newStatus === "active" 
        ? `"${product.rows[0].title}" is now Available & Live in store`
        : `"${product.rows[0].title}" has been Deactivated / Made Unavailable`,
      product: updated.rows[0]
    });

  } catch (err) {
    console.error(err);
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
      "UPDATE products SET status='deleted' WHERE id=$1 AND vendor_id=$2",
      [id, vendorId]
    );

    res.json({ message: "Product deleted from store" });

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }

};
