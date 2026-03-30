import jwt from "jsonwebtoken";

export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = decoded; // attach user if valid
    }

  } catch (err) {
    console.log("Optional auth skipped");
  }

  next(); // always allow
};