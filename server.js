import http from "http";
import dotenv from "dotenv";
dotenv.config();

import pool from "./config/db.js";
import app from "./app.js";
import { initSocket } from "./config/socket.js";

pool.connect()
.then(() => console.log("Database connected"))
.catch(err => console.log("DB error:", err));

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with WebSockets enabled`);
});
