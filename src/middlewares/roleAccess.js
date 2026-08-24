import { canManageUsers, isAdminRole } from "../utils/roleHelpers.js";

export const requireUserManager = (req, res, next) => {
  if (!req.user || !canManageUsers(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied: user management privileges required",
    });
  }
  next();
};

export const requireAdmin = async (req, res, next) => {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied: admin privileges required",
    });
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  const userRole = String(req.user?.role || "").toLowerCase();
  if (!req.user || !roles.map((r) => String(r).toLowerCase()).includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: "Access denied: insufficient permissions",
    });
  }
  next();
};
