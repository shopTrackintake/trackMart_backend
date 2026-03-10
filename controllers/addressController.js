import pool from "../config/db.js";

/* ================= ADD ADDRESS ================= */

export const addAddress = async (req, res) => {

  try {

    const userId = req.user.id;

    const {
      full_name,
      phone,
      house_no,
      street,
      locality,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude
    } = req.body;

    if(
      !full_name ||
      !phone ||
      !house_no ||
      !street ||
      !locality ||
      !city ||
      !state ||
      !pincode
    ){
      return res.status(400).json({
        message:"Required fields missing"
      });
    }

    const result = await pool.query(

      `INSERT INTO addresses
      (user_id,full_name,phone,house_no,street,locality,landmark,city,state,pincode,latitude,longitude)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,

      [
        userId,
        full_name,
        phone,
        house_no,
        street,
        locality,
        landmark || null,
        city,
        state,
        pincode,
        latitude || null,
        longitude || null
      ]

    );

    res.json(result.rows[0]);

  }

  catch(err){

    console.log("ADDRESS ERROR:",err);

    res.status(500).json({
      message:err.message
    });

  }

};


/* ================= GET ADDRESSES ================= */
export const getAddresses = async (req, res) => {

  try {

    const addresses = await pool.query(
      `SELECT *
       FROM addresses
       WHERE user_id=$1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(addresses.rows);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }

};


/* ================= UPDATE ADDRESS ================= */
export const updateAddress = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      full_name,
      phone,
      house_no,
      street,
      locality,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude
    } = req.body;

    await pool.query(
      `UPDATE addresses SET
       full_name=$1,
       phone=$2,
       house_no=$3,
       street=$4,
       locality=$5,
       landmark=$6,
       city=$7,
       state=$8,
       pincode=$9,
       latitude=$10,
       longitude=$11
       WHERE id=$12 AND user_id=$13`,
      [
        full_name,
        phone,
        house_no,
        street,
        locality,
        landmark,
        city,
        state,
        pincode,
        latitude,
        longitude,
        id,
        req.user.id
      ]
    );

    res.json({ message: "Address updated successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }

};


/* ================= DELETE ADDRESS ================= */
export const deleteAddress = async (req, res) => {

  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM addresses WHERE id=$1 AND user_id=$2",
      [id, req.user.id]
    );

    res.json({ message: "Address deleted" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }

};