import express from "express";
import {
  getMembershipYears,
  createMembershipYear,
  updateMembershipYear,
  deleteMembershipYear,
  getMembershipCategories,
  createMembershipCategory,
  updateMembershipCategory,
  deleteMembershipCategory,
  upsertFee,
  getCategoryPlatforms,
  createCategoryPlatform,
  deleteCategoryPlatform,
  getServices,
  createService,
  getApplicationSettings,
  updateApplicationSettings,
  setCategoryService,
} from "../controllers/membershipSetupController.js";
import { protect } from "../middlewares/protect.js";

const yearRouter = express.Router();
yearRouter.get("/", protect, getMembershipYears);
yearRouter.post("/", protect, createMembershipYear);
yearRouter.put("/:id", protect, updateMembershipYear);
yearRouter.delete("/:id", protect, deleteMembershipYear);

const categoryRouter = express.Router();
categoryRouter.get("/", protect, getMembershipCategories);
categoryRouter.post("/", protect, createMembershipCategory);
categoryRouter.put("/:id", protect, updateMembershipCategory);
categoryRouter.post("/:id/fees", protect, upsertFee);
categoryRouter.delete("/:id", protect, deleteMembershipCategory);

export { yearRouter, categoryRouter };

const extraRouter = express.Router();
extraRouter.get("/category-platforms", protect, getCategoryPlatforms);
extraRouter.post("/category-platforms", protect, createCategoryPlatform);
extraRouter.delete("/category-platforms/:id", protect, deleteCategoryPlatform);
extraRouter.get("/services", protect, getServices);
extraRouter.post("/services", protect, createService);
extraRouter.get("/application-settings", protect, getApplicationSettings);
extraRouter.put("/application-settings", protect, updateApplicationSettings);
extraRouter.post("/category-services", protect, setCategoryService);

export default extraRouter;
