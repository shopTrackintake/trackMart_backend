import express from "express";
import cors from "cors";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://trackmart-frontend.onrender.com"
  ],
  methods: ["GET","POST","PUT","DELETE"],
  credentials: true
}));

app.options("*", cors());

app.use(express.json());
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

export default app;
