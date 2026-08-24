import { isExecutiveRole } from "../utils/roleHelpers.js";

export const requireExecutive = (req, res, next) => {
  if (!req.user || !isExecutiveRole(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied: ED / Chairman privileges required",
    });
  }
  next();
};
