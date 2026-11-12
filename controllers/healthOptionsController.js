import pool from "../config/db.js";

/* ================= 1. GET ALL OPTIONS (CARE TYPES & CONCERNS) ================= */
export const getAllOptions = async (req, res) => {
  try {
    const careResult = await pool.query(`
      SELECT 
        ct.id, 
        ct.name, 
        ct.description,
        ct.created_at,
        COUNT(p.id)::int AS product_count
      FROM care_types ct
      LEFT JOIN products p ON (
        (',' || COALESCE(p.care_type, '') || ',') ILIKE ('%,' || ct.name || ',%')
        OR p.care_type ILIKE ('%' || ct.name || '%')
      ) AND (p.status != 'deleted' OR p.status IS NULL)
      GROUP BY ct.id, ct.name, ct.description, ct.created_at
      ORDER BY ct.name ASC
    `);

    const concernResult = await pool.query(`
      SELECT 
        hc.id, 
        hc.name, 
        hc.description,
        hc.created_at,
        COUNT(p.id)::int AS product_count
      FROM health_concerns hc
      LEFT JOIN products p ON (
        (',' || COALESCE(p.concern_type, '') || ',') ILIKE ('%,' || hc.name || ',%')
        OR p.concern_type ILIKE ('%' || hc.name || '%')
      ) AND (p.status != 'deleted' OR p.status IS NULL)
      GROUP BY hc.id, hc.name, hc.description, hc.created_at
      ORDER BY hc.name ASC
    `);

    res.json({
      careTypes: careResult.rows,
      healthConcerns: concernResult.rows
    });
  } catch (err) {
    console.error("GET ALL HEALTH OPTIONS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= 2. CARE TYPES CRUD ================= */

export const getCareTypes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ct.id, 
        ct.name, 
        ct.description,
        ct.created_at,
        COUNT(p.id)::int AS product_count
      FROM care_types ct
      LEFT JOIN products p ON (
        (',' || COALESCE(p.care_type, '') || ',') ILIKE ('%,' || ct.name || ',%')
        OR p.care_type ILIKE ('%' || ct.name || '%')
      ) AND (p.status != 'deleted' OR p.status IS NULL)
      GROUP BY ct.id, ct.name, ct.description, ct.created_at
      ORDER BY ct.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET CARE TYPES ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const createCareType = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Care type name is required" });
    }

    const cleanName = name.trim();

    // Check duplicate
    const existing = await pool.query(
      "SELECT id FROM care_types WHERE LOWER(name) = LOWER($1)",
      [cleanName]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: `Care type "${cleanName}" already exists`
      });
    }

    const insertRes = await pool.query(
      `INSERT INTO care_types (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at`,
      [cleanName, description?.trim() || null]
    );

    res.status(201).json({
      message: `Care type "${cleanName}" created successfully`,
      careType: {
        ...insertRes.rows[0],
        product_count: 0
      }
    });
  } catch (err) {
    console.error("CREATE CARE TYPE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateCareType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Care type name is required" });
    }

    const cleanName = name.trim();

    const existingCheck = await pool.query("SELECT * FROM care_types WHERE id = $1", [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ message: "Care type not found" });
    }

    const oldName = existingCheck.rows[0].name;

    // Check duplicate name
    const dupCheck = await pool.query(
      "SELECT id FROM care_types WHERE LOWER(name) = LOWER($1) AND id != $2",
      [cleanName, id]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Another care type named "${cleanName}" already exists`
      });
    }

    const updateRes = await pool.query(
      `UPDATE care_types
       SET name = $1, description = $2
       WHERE id = $3
       RETURNING id, name, description, created_at`,
      [cleanName, description !== undefined ? description?.trim() || null : existingCheck.rows[0].description, id]
    );

    // If name changed, rename occurrences in active products to maintain integrity
    if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
      await pool.query(
        `UPDATE products
         SET care_type = REPLACE(care_type, $1, $2)
         WHERE care_type ILIKE ('%' || $1 || '%')`,
        [oldName, cleanName]
      );
    }

    const countRes = await pool.query(
      `SELECT COUNT(p.id)::int AS product_count FROM products p
       WHERE ((',' || COALESCE(p.care_type, '') || ',') ILIKE ('%,' || $1 || ',%') OR p.care_type ILIKE ('%' || $1 || '%'))
       AND (p.status != 'deleted' OR p.status IS NULL)`,
      [cleanName]
    );

    res.json({
      message: `Care type "${cleanName}" updated successfully`,
      careType: {
        ...updateRes.rows[0],
        product_count: countRes.rows[0]?.product_count || 0
      }
    });
  } catch (err) {
    console.error("UPDATE CARE TYPE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteCareType = async (req, res) => {
  try {
    const { id } = req.params;

    const existingCheck = await pool.query("SELECT * FROM care_types WHERE id = $1", [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ message: "Care type not found" });
    }

    const careName = existingCheck.rows[0].name;

    // Check if products are currently assigned to this care type
    const productsCheck = await pool.query(
      `SELECT id FROM products 
       WHERE ((',' || COALESCE(care_type, '') || ',') ILIKE ('%,' || $1 || ',%') OR care_type ILIKE ('%' || $1 || '%'))
       AND (status != 'deleted' OR status IS NULL)
       LIMIT 1`,
      [careName]
    );

    if (productsCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Cannot delete care type "${careName}" because it is currently linked to active products. Please remove or reassign it from those products first.`
      });
    }

    await pool.query("DELETE FROM care_types WHERE id = $1", [id]);

    res.json({
      message: `Care type "${careName}" deleted successfully`,
      deletedId: Number(id)
    });
  } catch (err) {
    console.error("DELETE CARE TYPE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= 3. HEALTH CONCERNS CRUD ================= */

export const getHealthConcerns = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        hc.id, 
        hc.name, 
        hc.description,
        hc.created_at,
        COUNT(p.id)::int AS product_count
      FROM health_concerns hc
      LEFT JOIN products p ON (
        (',' || COALESCE(p.concern_type, '') || ',') ILIKE ('%,' || hc.name || ',%')
        OR p.concern_type ILIKE ('%' || hc.name || '%')
      ) AND (p.status != 'deleted' OR p.status IS NULL)
      GROUP BY hc.id, hc.name, hc.description, hc.created_at
      ORDER BY hc.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET HEALTH CONCERNS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const createHealthConcern = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Health concern name is required" });
    }

    const cleanName = name.trim();

    // Check duplicate
    const existing = await pool.query(
      "SELECT id FROM health_concerns WHERE LOWER(name) = LOWER($1)",
      [cleanName]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: `Health concern "${cleanName}" already exists`
      });
    }

    const insertRes = await pool.query(
      `INSERT INTO health_concerns (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at`,
      [cleanName, description?.trim() || null]
    );

    res.status(201).json({
      message: `Health concern "${cleanName}" created successfully`,
      healthConcern: {
        ...insertRes.rows[0],
        product_count: 0
      }
    });
  } catch (err) {
    console.error("CREATE HEALTH CONCERN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateHealthConcern = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Health concern name is required" });
    }

    const cleanName = name.trim();

    const existingCheck = await pool.query("SELECT * FROM health_concerns WHERE id = $1", [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ message: "Health concern not found" });
    }

    const oldName = existingCheck.rows[0].name;

    // Check duplicate name
    const dupCheck = await pool.query(
      "SELECT id FROM health_concerns WHERE LOWER(name) = LOWER($1) AND id != $2",
      [cleanName, id]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Another health concern named "${cleanName}" already exists`
      });
    }

    const updateRes = await pool.query(
      `UPDATE health_concerns
       SET name = $1, description = $2
       WHERE id = $3
       RETURNING id, name, description, created_at`,
      [cleanName, description !== undefined ? description?.trim() || null : existingCheck.rows[0].description, id]
    );

    // If name changed, rename occurrences in active products to maintain integrity
    if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
      await pool.query(
        `UPDATE products
         SET concern_type = REPLACE(concern_type, $1, $2)
         WHERE concern_type ILIKE ('%' || $1 || '%')`,
        [oldName, cleanName]
      );
    }

    const countRes = await pool.query(
      `SELECT COUNT(p.id)::int AS product_count FROM products p
       WHERE ((',' || COALESCE(p.concern_type, '') || ',') ILIKE ('%,' || $1 || ',%') OR p.concern_type ILIKE ('%' || $1 || '%'))
       AND (p.status != 'deleted' OR p.status IS NULL)`,
      [cleanName]
    );

    res.json({
      message: `Health concern "${cleanName}" updated successfully`,
      healthConcern: {
        ...updateRes.rows[0],
        product_count: countRes.rows[0]?.product_count || 0
      }
    });
  } catch (err) {
    console.error("UPDATE HEALTH CONCERN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteHealthConcern = async (req, res) => {
  try {
    const { id } = req.params;

    const existingCheck = await pool.query("SELECT * FROM health_concerns WHERE id = $1", [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ message: "Health concern not found" });
    }

    const concernName = existingCheck.rows[0].name;

    // Check if products are currently assigned to this health concern
    const productsCheck = await pool.query(
      `SELECT id FROM products 
       WHERE ((',' || COALESCE(concern_type, '') || ',') ILIKE ('%,' || $1 || ',%') OR concern_type ILIKE ('%' || $1 || '%'))
       AND (status != 'deleted' OR status IS NULL)
       LIMIT 1`,
      [concernName]
    );

    if (productsCheck.rows.length > 0) {
      return res.status(400).json({
        message: `Cannot delete health concern "${concernName}" because it is currently linked to active products. Please remove or reassign it from those products first.`
      });
    }

    await pool.query("DELETE FROM health_concerns WHERE id = $1", [id]);

    res.json({
      message: `Health concern "${concernName}" deleted successfully`,
      deletedId: Number(id)
    });
  } catch (err) {
    console.error("DELETE HEALTH CONCERN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

