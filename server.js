import dotenv from "dotenv";
dotenv.config();   // 🔥 FIRST LINE

import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("JWT_SECRET:", process.env.JWT_SECRET); // 🔍 Debug
  console.log(`Server running on port ${PORT}`);
});