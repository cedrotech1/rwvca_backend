import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import {
  isForceDeactivated,
  isPendingProfileActivation,
} from "../utils/profileCompleteness.js";

const User = db["Users"];

const PENDING_PROFILE_ALLOWED = [
  "/auth/me",
  "/auth/profile",
  "/auth/signature",
  "/auth/change-password",
  "/auth/logout",
];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function normalizeApiPath(url = "") {
  const raw = String(url || "").split("?")[0];
  const cleaned = raw.replace(/^\/api\/v\d+/i, "");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

function isPendingProfilePath(req) {
  const path = normalizeApiPath(req.originalUrl || req.url || "");
  return PENDING_PROFILE_ALLOWED.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`)
  );
}

export const protect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }

  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret());

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    if (isForceDeactivated(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated by an administrator. Contact HR.",
        code: "ACCOUNT_FORCE_DEACTIVATED",
      });
    }

    // Pending users may only complete profile / password / logout until activated.
    if (isPendingProfileActivation(user) && !isPendingProfilePath(req)) {
      return res.status(403).json({
        success: false,
        message: "Complete your profile to activate your account before using the system.",
        code: "PROFILE_INCOMPLETE",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(401).json({ success: false, message: "Not authorized" });
  }
});

export const optionalProtect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization;

  if (auth && auth.startsWith("Bearer ")) {
    try {
      const token = auth.split(" ")[1];
      const decoded = jwt.verify(token, getJwtSecret());
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
      if (user && !isForceDeactivated(user)) {
        req.user = user;
      }
    } catch (error) {
      console.error("JWT Verification Error (Optional Protect):", error.message);
    }
  }

  next();
});
