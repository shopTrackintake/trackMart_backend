import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "trackmart_products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"]
  }
});

export const upload = multer({ storage });

export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max Excel file
});
