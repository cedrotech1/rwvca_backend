import express from "express";
import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  addInventoryTransaction,
  deleteInventoryItem,
  getInventoryTransactions,
  getInventorySummary,
  deleteInventoryTransaction,
  truncateInventory,
} from "../controllers/inventoryController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getInventoryItems);
router.get("/summary/report", protect, getInventorySummary);
router.get("/transactions/log", protect, getInventoryTransactions);
router.get("/:id", protect, getInventoryItem);
router.post("/", protect, createInventoryItem);
router.put("/:id", protect, updateInventoryItem);
router.post("/:id/transactions", protect, addInventoryTransaction);
router.delete("/transactions/:transactionId", protect, deleteInventoryTransaction);
router.delete("/truncate/all", protect, truncateInventory);
router.delete("/:id", protect, deleteInventoryItem);

export default router;
