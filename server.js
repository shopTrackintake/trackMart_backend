import dotenv from "dotenv";
dotenv.config();

import pool from "./config/db.js";
import app from "./app.js";

pool.connect()
.then(() => console.log("Database connected"))
.catch(err => console.log("DB error:", err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
