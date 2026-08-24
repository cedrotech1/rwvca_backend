import express from "express";
import { getSubscribers, updateSubscriber, deleteSubscriber } from "../controllers/inboxController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getSubscribers);
router.put("/:id", protect, updateSubscriber);
router.delete("/:id", protect, deleteSubscriber);

export default router;
