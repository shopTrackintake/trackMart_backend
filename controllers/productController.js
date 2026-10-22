import pool from "../config/db.js";
import xlsx from "xlsx";
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
      WHERE p.id = $1 AND (p.status != 'deleted' OR p.status IS NULL)
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
      min_price,
      max_price,
      discount_only,
      in_stock,
      dietary_type,
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

    /* FILTERS */

    if (search) {
      baseQuery += `
        AND (
          p.title ILIKE $${index}
          OR p.description ILIKE $${index}
          OR p.care_type ILIKE $${index}
          OR p.concern_type ILIKE $${index}
          OR p.brand_name ILIKE $${index}
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

    if (dietary_type) {
      baseQuery += ` AND p.dietary_type ILIKE $${index}`;
      values.push(`%${dietary_type}%`);
      index++;
    }

    const effectiveMaxPrice = max_price || price;
    if (effectiveMaxPrice) {
      baseQuery += ` AND p.price <= $${index}`;
      values.push(Number(effectiveMaxPrice));
      index++;
    }

    if (min_price) {
      baseQuery += ` AND p.price >= $${index}`;
      values.push(Number(min_price));
      index++;
    }

    if (discount_only === "true" || discount_only === true) {
      baseQuery += ` AND p.discount_percent > 0`;
    }

    if (in_stock === "true" || in_stock === true) {
      baseQuery += ` AND (p.stock > 0 OR p.stock IS NULL)`;
    }

    /* SORT */
    let orderBy = `ORDER BY p.created_at DESC`;
    if (sort === "price_low") orderBy = `ORDER BY p.price ASC`;
    if (sort === "price_high") orderBy = `ORDER BY p.price DESC`;
    if (sort === "discount") orderBy = `ORDER BY COALESCE(p.discount_percent, 0) DESC, p.created_at DESC`;
    if (sort === "title_asc") orderBy = `ORDER BY p.title ASC`;
    if (sort === "title_desc") orderBy = `ORDER BY p.title DESC`;

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

    /* HEALTH RATING - DISABLED */
    const health_rating = null;

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

    const health_rating = null;

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

/* ================= EXCEL TEMPLATE CONFIGURATION ================= */

export const EXCEL_TEMPLATE_COLUMNS = [
  "Product Title * [REQUIRED]",
  "Price (₹) * [REQUIRED]",
  "Stock Quantity * [REQUIRED]",
  "Size / Net Quantity * [REQUIRED]",
  "Category Name",
  "Discount Percent (%)",
  "Brand Name",
  "SKU Code",
  "Barcode / EAN",
  "Main Product Image URL",
  "Ingredients Packaging Image URL",
  "Ingredients",
  "Dietary Type",
  "Flavour",
  "Care Type",
  "Concern Type",
  "Calories (kcal)",
  "Sugar (g)",
  "Fat (g)",
  "Protein (g)",
  "Serving Size",
  "Servings Per Container",
  "Net Weight",
  "Product Description",
  "How To Use / Directions",
  "Manufacturing Process",
  "Manufacturer Name",
  "Manufacturer Address",
  "FSSAI License Number",
  "Batch Number",
  "Manufacturing Date (YYYY-MM-DD)",
  "Expiry Date (YYYY-MM-DD)",
  "Nutrition Facts per 100g",
  "Nutrition Facts per Serving"
];

export const EXCEL_SAMPLE_ROWS = [
  {
    "Product Title * [REQUIRED]": "Organic Himalayan Raw Forest Honey",
    "Price (₹) * [REQUIRED]": 499,
    "Stock Quantity * [REQUIRED]": 75,
    "Size / Net Quantity * [REQUIRED]": "500g",
    "Category Name": "Organic Foods",
    "Discount Percent (%)": 10,
    "Brand Name": "NaturePure Organic",
    "SKU Code": "NPO-HONEY-500",
    "Barcode / EAN": "8901234567890",
    "Main Product Image URL": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80",
    "Ingredients Packaging Image URL": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=600&q=80",
    "Ingredients": "100% Pure Raw Multi-Floral Forest Honey, No Added Sugar, No Preservatives",
    "Dietary Type": "Vegetarian",
    "Flavour": "Wildflower",
    "Care Type": "Immunity & Wellness Care",
    "Concern Type": "Immunity Support",
    "Calories (kcal)": 320,
    "Sugar (g)": 16,
    "Fat (g)": 0,
    "Protein (g)": 0.5,
    "Serving Size": "1 Tablespoon (15g)",
    "Servings Per Container": "33",
    "Net Weight": "500g",
    "Product Description": "Unprocessed, naturally crystallized organic raw forest honey harvested ethically from Himalayan wild flora.",
    "How To Use / Directions": "Take 1 tablespoon daily morning with warm water or mix with herbal tea.",
    "Manufacturing Process": "Cold filtered, unpasteurized to preserve natural enzymes, bee pollen, and antioxidants.",
    "Manufacturer Name": "NaturePure Organics Ltd",
    "Manufacturer Address": "Plot 12, Valley Industrial Estate, Dehradun, Uttarakhand - 248001",
    "FSSAI License Number": "10022011000845",
    "Batch Number": "HMY-2026-OCT",
    "Manufacturing Date (YYYY-MM-DD)": "2026-10-01",
    "Expiry Date (YYYY-MM-DD)": "2028-10-01",
    "Nutrition Facts per 100g": "Energy: 320 kcal, Carbs: 80g, Natural Sugars: 78g, Protein: 0.5g",
    "Nutrition Facts per Serving": "Energy: 48 kcal, Carbs: 12g, Natural Sugars: 11.7g"
  },
  {
    "Product Title * [REQUIRED]": "California Roasted Almonds (Lightly Salted)",
    "Price (₹) * [REQUIRED]": 349,
    "Stock Quantity * [REQUIRED]": 120,
    "Size / Net Quantity * [REQUIRED]": "250g",
    "Category Name": "Healthy Snacks",
    "Discount Percent (%)": 15,
    "Brand Name": "NutriCrunch",
    "SKU Code": "NC-ALM-250",
    "Barcode / EAN": "8909876543210",
    "Main Product Image URL": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=600&q=80",
    "Ingredients Packaging Image URL": "https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80",
    "Ingredients": "California Supreme Almonds (99%), Himalayan Pink Rock Salt (1%)",
    "Dietary Type": "Vegan",
    "Flavour": "Roasted & Salted",
    "Care Type": "Heart & Cholesterol Care",
    "Concern Type": "General Wellbeing",
    "Calories (kcal)": 579,
    "Sugar (g)": 4.4,
    "Fat (g)": 49.9,
    "Protein (g)": 21.2,
    "Serving Size": "28g (approx. 23 nuts)",
    "Servings Per Container": "9",
    "Net Weight": "250g",
    "Product Description": "Crispy dry-roasted California supreme almonds seasoned with authentic Himalayan pink salt.",
    "How To Use / Directions": "Ready to eat nutritious crunch between meals or as pre-workout energy.",
    "Manufacturing Process": "Slow dry roasted without oil and nitrogen flushed for lasting crunchiness.",
    "Manufacturer Name": "NutriCrunch Foods Pvt Ltd",
    "Manufacturer Address": "GIDC Naroda, Ahmedabad, Gujarat - 382330",
    "FSSAI License Number": "10019022000512",
    "Batch Number": "ALM-2026-B1",
    "Manufacturing Date (YYYY-MM-DD)": "2026-09-15",
    "Expiry Date (YYYY-MM-DD)": "2027-03-15",
    "Nutrition Facts per 100g": "Energy: 579 kcal, Dietary Fiber: 12.5g, Protein: 21.2g, Healthy Fats: 49.9g",
    "Nutrition Facts per Serving": "Energy: 162 kcal, Protein: 6g, Fiber: 3.5g"
  },
  {
    "Product Title * [REQUIRED]": "Plant Protein Isolate Powder (Belgian Chocolate)",
    "Price (₹) * [REQUIRED]": 1899,
    "Stock Quantity * [REQUIRED]": 40,
    "Size / Net Quantity * [REQUIRED]": "1kg",
    "Category Name": "Protein & Supplements",
    "Discount Percent (%)": 20,
    "Brand Name": "ProFit Fuel",
    "SKU Code": "PFF-PLANT-1KG",
    "Barcode / EAN": "8905647382910",
    "Main Product Image URL": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=600&q=80",
    "Ingredients Packaging Image URL": "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=600&q=80",
    "Ingredients": "Fermented Pea Protein Isolate, Organic Brown Rice Protein, Cocoa Powder, Stevia Leaf Extract, Digestive Enzymes (Papain, Bromelain)",
    "Dietary Type": "Vegan",
    "Flavour": "Belgian Chocolate",
    "Care Type": "Muscle & Fitness Care",
    "Concern Type": "Muscle Building & Recovery",
    "Calories (kcal)": 380,
    "Sugar (g)": 0.8,
    "Fat (g)": 3.2,
    "Protein (g)": 78,
    "Serving Size": "1 Scoop (33g)",
    "Servings Per Container": "30",
    "Net Weight": "1000g",
    "Product Description": "100% plant-based clean protein delivering 25g protein per scoop with complete amino acid profile.",
    "How To Use / Directions": "Shake 1 scoop with 300ml cold water or plant milk within 30 minutes post workout.",
    "Manufacturing Process": "Low-temperature water extraction, non-GMO, micro-filtered and lab-tested for heavy metals.",
    "Manufacturer Name": "ProFit Nutrition Labs",
    "Manufacturer Address": "Tech Bio Park, Electronic City, Bengaluru - 560100",
    "FSSAI License Number": "10018043000721",
    "Batch Number": "PFF-2026-CHOC",
    "Manufacturing Date (YYYY-MM-DD)": "2026-10-10",
    "Expiry Date (YYYY-MM-DD)": "2028-04-10",
    "Nutrition Facts per 100g": "Energy: 380 kcal, Protein: 78g, Carbs: 8.5g, BCAA: 15.2g",
    "Nutrition Facts per Serving": "Energy: 125 kcal, Protein: 25.7g, BCAA: 5g, Sugar: 0.2g"
  }
];

/* Helper to safely extract values by multiple potential keys / case-insensitive */
const getCleanVal = (row, ...keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK) {
        if (row[rk] !== undefined && row[rk] !== null && String(row[rk]).trim() !== "") {
          return String(row[rk]).trim();
        }
      }
    }
  }
  return "";
};

/* Helper to parse dates from Excel serials or date strings */
const parseDateVal = (val) => {
  if (!val) return null;
  if (typeof val === "number") {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
  }
  const cleanStr = String(val).trim();
  if (!cleanStr) return null;
  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
};

/* ================= 1. DOWNLOAD EXCEL TEMPLATE ================= */
export const downloadProductTemplate = async (req, res) => {
  try {
    const catRes = await pool.query("SELECT id, name FROM categories ORDER BY name ASC");
    const categories = catRes.rows;

    const workbook = xlsx.utils.book_new();

    // Sheet 1: Products Upload Template
    const worksheet = xlsx.utils.json_to_sheet(EXCEL_SAMPLE_ROWS, {
      header: EXCEL_TEMPLATE_COLUMNS
    });

    // Column widths for easy readability
    worksheet["!cols"] = EXCEL_TEMPLATE_COLUMNS.map((col) => ({
      wch: Math.max(col.length + 4, 18)
    }));

    xlsx.utils.book_append_sheet(workbook, worksheet, "Products Upload Template");

    // Sheet 2: Guidelines & Available Categories
    const guideData = [
      {
        Field: "Product Title * [REQUIRED]",
        Requirement: "MANDATORY",
        Description: "Clear item name including brand or variant (e.g. Organic Raw Honey 500g)"
      },
      {
        Field: "Price (₹) * [REQUIRED]",
        Requirement: "MANDATORY",
        Description: "Selling price in INR numbers only (e.g. 499)"
      },
      {
        Field: "Stock Quantity * [REQUIRED]",
        Requirement: "MANDATORY",
        Description: "Available units in inventory (e.g. 50)"
      },
      {
        Field: "Size / Net Quantity * [REQUIRED]",
        Requirement: "MANDATORY",
        Description: "Unit size (e.g. 500g, 1L, 100 Capsules, 250ml)"
      },
      {
        Field: "Category Name",
        Requirement: "RECOMMENDED",
        Description: `Pick from: ${categories.map((c) => c.name).join(", ")}`
      },
      {
        Field: "Discount Percent (%)",
        Requirement: "OPTIONAL",
        Description: "Percentage off (0 to 90)"
      },
      {
        Field: "Main Product Image URL",
        Requirement: "RECOMMENDED",
        Description: "Direct public URL (HTTPS link from Cloudinary, Imgur, or cloud storage)"
      },
      {
        Field: "Ingredients Packaging Image URL",
        Requirement: "OPTIONAL",
        Description: "Direct public URL to back label or ingredients photo"
      },
      {
        Field: "Dietary Type",
        Requirement: "OPTIONAL",
        Description: "Vegetarian, Vegan, Gluten-Free, Keto-Friendly, Organic, Sugar-Free, etc."
      },
      {
        Field: "FSSAI License Number",
        Requirement: "RECOMMENDED",
        Description: "14-digit FSSAI registration/license number"
      }
    ];

    const guideSheet = xlsx.utils.json_to_sheet(guideData);
    guideSheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 60 }];
    xlsx.utils.book_append_sheet(workbook, guideSheet, "Guidelines & Reference");

    const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="trackmart_vendor_products_template.xlsx"'
    );
    return res.send(excelBuffer);
  } catch (err) {
    console.error("Template generation error:", err);
    res.status(500).json({ message: "Failed to generate Excel template" });
  }
};

/* ================= 2. BULK UPLOAD PRODUCTS ================= */
export const bulkUploadProducts = async (req, res) => {
  try {
    // 1. Verify vendor authentication
    const vendor = await pool.query(
      "SELECT id, business_name FROM vendors WHERE user_id = $1",
      [req.user.id]
    );

    if (!vendor.rows.length) {
      return res.status(400).json({
        message: "Vendor profile not found for this account"
      });
    }

    const vendor_id = vendor.rows[0].id;
    const vendorName = vendor.rows[0].business_name;

    // 2. Extract rows from file or body
    let rawRows = [];
    if (req.file) {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
    } else if (Array.isArray(req.body.products)) {
      rawRows = req.body.products;
    } else {
      return res.status(400).json({
        message: "No product data or Excel file provided. Upload an .xlsx file or submit product records."
      });
    }

    if (!rawRows.length) {
      return res.status(400).json({
        message: "The uploaded spreadsheet does not contain any product rows."
      });
    }

    // 3. Pre-fetch categories for fast name-to-id resolution
    const catRes = await pool.query("SELECT id, name FROM categories");
    const catMap = new Map();
    const catNameMap = new Map();
    catRes.rows.forEach((c) => {
      catMap.set(c.name.toLowerCase().trim(), c.id);
      catMap.set(String(c.id), c.id);
      catNameMap.set(c.id, c.name);
    });

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 4. Process each row sequentially with comprehensive error reporting
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowIndex = i + 2; // Row 1 is header, so data starts at row 2 in Excel

      // Extract required fields
      const title = getCleanVal(row, "Product Title * [REQUIRED]", "Product Title", "Title", "Product Name", "title");
      const rawPrice = getCleanVal(row, "Price (₹) * [REQUIRED]", "Price (₹)", "Price", "price", "mrp");
      const rawStock = getCleanVal(row, "Stock Quantity * [REQUIRED]", "Stock Quantity", "Stock", "stock", "quantity");
      const size = getCleanVal(row, "Size / Net Quantity * [REQUIRED]", "Size / Net Quantity", "Size", "size", "net_weight", "weight");

      // Skip blank rows
      if (!title && !rawPrice && !rawStock && !size) {
        continue;
      }

      // Validate required fields
      if (!title) {
        results.push({
          row: rowIndex,
          title: "(Untitled Product)",
          status: "failed",
          error: "Product Title * [REQUIRED] is missing"
        });
        failedCount++;
        continue;
      }

      const cleanPrice = String(rawPrice).replace(/[₹,\s]/g, "");
      const parsedPrice = Number(cleanPrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        results.push({
          row: rowIndex,
          title,
          status: "failed",
          error: `Invalid Price "${rawPrice}". Price must be a valid number greater than ₹0.`
        });
        failedCount++;
        continue;
      }

      const cleanStock = String(rawStock).replace(/[,\s]/g, "");
      const parsedStock = Number(cleanStock);
      if (isNaN(parsedStock) || parsedStock < 0) {
        results.push({
          row: rowIndex,
          title,
          status: "failed",
          error: `Invalid Stock Quantity "${rawStock}". Stock must be a non-negative number (0 or more).`
        });
        failedCount++;
        continue;
      }

      if (!size) {
        results.push({
          row: rowIndex,
          title,
          status: "failed",
          error: "Size / Net Quantity * [REQUIRED] is missing (e.g. 500g, 1L, 100 capsules)."
        });
        failedCount++;
        continue;
      }

      // Check duplicates for this vendor
      const existingProduct = await pool.query(
        `SELECT id FROM products 
         WHERE vendor_id = $1 
         AND LOWER(title) = LOWER($2)
         AND (status = 'active' OR status IS NULL)`,
        [vendor_id, title]
      );

      if (existingProduct.rows.length > 0) {
        results.push({
          row: rowIndex,
          title,
          status: "failed",
          error: `Duplicate: A live product titled "${title}" already exists in your catalog (ID: #${existingProduct.rows[0].id.slice(0, 8)}).`
        });
        failedCount++;
        continue;
      }

      // Extract optional fields
      const rawCategory = getCleanVal(row, "Category Name", "Category", "category_name", "category_id", "category");
      let category_id = null;
      if (rawCategory) {
        const cleanCat = rawCategory.toLowerCase().trim();
        if (catMap.has(cleanCat)) {
          category_id = catMap.get(cleanCat);
        } else if (!isNaN(Number(rawCategory)) && catMap.has(String(Number(rawCategory)))) {
          category_id = Number(rawCategory);
        }
      }

      const rawDiscount = getCleanVal(row, "Discount Percent (%)", "Discount %", "discount_percent", "discount");
      const parsedDiscount = rawDiscount && !isNaN(Number(rawDiscount)) ? Math.max(0, Math.min(99, Number(rawDiscount))) : 0;

      const brand_name = getCleanVal(row, "Brand Name", "Brand", "brand_name") || null;
      const sku = getCleanVal(row, "SKU Code", "SKU", "sku") || null;
      const barcode = getCleanVal(row, "Barcode / EAN", "Barcode", "barcode") || null;

      const image_url = getCleanVal(row, "Main Product Image URL", "Product Image URL", "Image URL", "image_url") || null;
      const ingredients_image_url = getCleanVal(row, "Ingredients Packaging Image URL", "Ingredients Image URL", "ingredients_image_url") || null;

      const ingredients = getCleanVal(row, "Ingredients", "Ingredient List", "ingredients") || null;
      const dietary_type = getCleanVal(row, "Dietary Type", "dietary_type", "Dietary") || null;
      const flavour = getCleanVal(row, "Flavour", "Flavor", "flavour", "flavor") || null;
      const care_type = getCleanVal(row, "Care Type", "care_type") || null;
      const concern_type = getCleanVal(row, "Concern Type", "concern_type") || null;

      const rawCalories = getCleanVal(row, "Calories (kcal)", "Calories", "calories");
      const parsedCalories = rawCalories && !isNaN(Number(rawCalories)) ? Number(rawCalories) : null;

      const rawSugar = getCleanVal(row, "Sugar (g)", "Sugar", "sugar");
      const parsedSugar = rawSugar && !isNaN(Number(rawSugar)) ? Number(rawSugar) : null;

      const rawFat = getCleanVal(row, "Fat (g)", "Fat", "fat");
      const parsedFat = rawFat && !isNaN(Number(rawFat)) ? Number(rawFat) : null;

      const rawProtein = getCleanVal(row, "Protein (g)", "Protein", "protein");
      const parsedProtein = rawProtein && !isNaN(Number(rawProtein)) ? Number(rawProtein) : null;

      const health_rating = null;

      const serving_size = getCleanVal(row, "Serving Size", "serving_size") || null;
      const servings_per_container = getCleanVal(row, "Servings Per Container", "servings_per_container") || null;
      const net_weight = getCleanVal(row, "Net Weight", "net_weight") || size;

      const description = getCleanVal(row, "Product Description", "Description", "description") || null;
      const how_to_use = getCleanVal(row, "How To Use / Directions", "How To Use", "how_to_use") || null;
      const making_process = getCleanVal(row, "Manufacturing Process", "Making Process", "making_process") || null;

      const manufacturer_name = getCleanVal(row, "Manufacturer Name", "manufacturer_name") || null;
      const manufacturer_address = getCleanVal(row, "Manufacturer Address", "manufacturer_address") || null;
      const fssai_license = getCleanVal(row, "FSSAI License Number", "FSSAI License", "fssai_license") || null;
      const batch_number = getCleanVal(row, "Batch Number", "batch_number") || null;

      const mfg_date = parseDateVal(getCleanVal(row, "Manufacturing Date (YYYY-MM-DD)", "Mfg Date", "mfg_date"));
      const expiry_date = parseDateVal(getCleanVal(row, "Expiry Date (YYYY-MM-DD)", "Expiry Date", "expiry_date"));

      const nutrition_per_100g = getCleanVal(row, "Nutrition Facts per 100g", "nutrition_per_100g") || null;
      const nutrition_per_serving = getCleanVal(row, "Nutrition Facts per Serving", "nutrition_per_serving") || null;

      // Insert product into database
      try {
        const insertRes = await pool.query(
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
           nutrition_per_serving, status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
                 $31,$32,$33,$34,$35,$36, 'active')
          RETURNING id, title, price, stock, category_id
          `,
          [
            vendor_id,
            category_id,
            title,
            description,
            parsedPrice,
            parsedDiscount,
            parsedStock,
            size,
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
            image_url,
            ingredients_image_url,
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
          ]
        );

        results.push({
          row: rowIndex,
          title,
          status: "success",
          productId: insertRes.rows[0].id,
          price: parsedPrice,
          stock: parsedStock,
          size,
          category: category_id ? catNameMap.get(category_id) || "Standard" : "Uncategorized",
          message: "Product added successfully to catalog"
        });
        successCount++;
      } catch (rowErr) {
        console.error(`Error inserting row ${rowIndex}:`, rowErr);
        results.push({
          row: rowIndex,
          title,
          status: "failed",
          error: rowErr.message || "Database insert error"
        });
        failedCount++;
      }
    }

    // 5. If products were added, notify platform admins
    if (successCount > 0) {
      const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES($1, $2, $3, $4)`,
          [
            admin.id,
            "Bulk Products Added",
            `Vendor "${vendorName}" imported ${successCount} products via Excel spreadsheet`,
            "product"
          ]
        );
      }
    }

    return res.json({
      success: true,
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount
      },
      results
    });
  } catch (err) {
    console.error("Bulk upload controller error:", err);
    res.status(500).json({ message: err.message || "Failed to process bulk upload" });
  }
};

