import pool from "../config/db.js";

// Helper function to create URL-safe slug
const slugify = (text) => {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/* ================= 1. GET ALL CATEGORIES ================= */
export const getCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.name, 
        c.slug, 
        c.benefits,
        COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND (p.status != 'deleted' OR p.status IS NULL)
      GROUP BY c.id, c.name, c.slug, c.benefits
      ORDER BY c.name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("CATEGORY GET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= 2. CREATE CATEGORY (ADMIN) ================= */
export const createCategory = async (req, res) => {
  try {
    const { name, benefits } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const cleanName = name.trim();
    let baseSlug = slugify(cleanName);
    if (!baseSlug) baseSlug = "category-" + Date.now();

    // Check duplicate name
    const existing = await pool.query(
      "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1)",
      [cleanName]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: `Category "${cleanName}" already exists`
      });
    }

    // Ensure unique slug
    let finalSlug = baseSlug;
    let slugCheck = await pool.query(
      "SELECT id FROM categories WHERE slug = $1",
      [finalSlug]
    );
    let counter = 1;
    while (slugCheck.rows.length > 0) {
      finalSlug = `${baseSlug}-${counter}`;
      slugCheck = await pool.query(
        "SELECT id FROM categories WHERE slug = $1",
        [finalSlug]
      );
      counter++;
    }

    // Default benefits or parsed benefits
    let benefitsJson = [];
    if (Array.isArray(benefits)) {
      benefitsJson = benefits;
    } else if (typeof benefits === "string") {
      try {
        benefitsJson = JSON.parse(benefits);
      } catch {
        benefitsJson = [];
      }
    }

    const insertRes = await pool.query(
      `
      INSERT INTO categories (name, slug, benefits)
      VALUES ($1, $2, $3)
      RETURNING id, name, slug, benefits
      `,
      [cleanName, finalSlug, JSON.stringify(benefitsJson)]
    );

    res.status(201).json({
      message: `Category "${cleanName}" created successfully`,
      category: {
        ...insertRes.rows[0],
        product_count: 0
      }
    });
  } catch (err) {
    console.error("CATEGORY CREATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= 3. UPDATE CATEGORY (ADMIN) ================= */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, benefits } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const cleanName = name.trim();

    // Check if category exists
    const catCheck = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check duplicate name on other categories
    const dupCheck = await pool.query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2",
      [cleanName, id]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Another category named "${cleanName}" already exists`
      });
    }

    let finalSlug = catCheck.rows[0].slug;
    if (cleanName.toLowerCase() !== catCheck.rows[0].name.toLowerCase()) {
      let baseSlug = slugify(cleanName) || "category";
      finalSlug = baseSlug;
      let slugCheck = await pool.query(
        "SELECT id FROM categories WHERE slug = $1 AND id != $2",
        [finalSlug, id]
      );
      let counter = 1;
      while (slugCheck.rows.length > 0) {
        finalSlug = `${baseSlug}-${counter}`;
        slugCheck = await pool.query(
          "SELECT id FROM categories WHERE slug = $1 AND id != $2",
          [finalSlug, id]
        );
        counter++;
      }
    }

    let benefitsJson = catCheck.rows[0].benefits || [];
    if (benefits !== undefined) {
      if (Array.isArray(benefits)) {
        benefitsJson = benefits;
      } else if (typeof benefits === "string") {
        try {
          benefitsJson = JSON.parse(benefits);
        } catch {
          benefitsJson = [];
        }
      }
    }

    const updateRes = await pool.query(
      `
      UPDATE categories
      SET name = $1, slug = $2, benefits = $3
      WHERE id = $4
      RETURNING id, name, slug, benefits
      `,
      [cleanName, finalSlug, JSON.stringify(benefitsJson), id]
    );

    const countRes = await pool.query(
      "SELECT COUNT(id)::int AS count FROM products WHERE category_id = $1 AND (status != 'deleted' OR status IS NULL)",
      [id]
    );

    res.json({
      message: `Category "${cleanName}" updated successfully`,
      category: {
        ...updateRes.rows[0],
        product_count: countRes.rows[0]?.count || 0
      }
    });
  } catch (err) {
    console.error("CATEGORY UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= 4. DELETE CATEGORY (ADMIN) ================= */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const catCheck = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    const catName = catCheck.rows[0].name;

    // Check if products are currently assigned to this category
    const productsCheck = await pool.query(
      "SELECT id FROM products WHERE category_id = $1 AND (status != 'deleted' OR status IS NULL) LIMIT 1",
      [id]
    );

    if (productsCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Cannot delete category "${catName}" because it is currently linked to active products. Please reassign or delete those products first.`
      });
    }

    await pool.query("DELETE FROM categories WHERE id = $1", [id]);

    res.json({
      message: `Category "${catName}" deleted successfully`,
      deletedId: Number(id)
    });
  } catch (err) {
    console.error("CATEGORY DELETE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
