import express from "express";
import {
  getCommunications,
  getCommunication,
  createCommunication,
  addCommunicationReply,
  markCommunicationViewed,
  deleteCommunication,
} from "../controllers/communicationController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getCommunications);
router.get("/:id", protect, getCommunication);
router.post("/", protect, createCommunication);
router.post("/:id/replies", protect, addCommunicationReply);
router.post("/:id/viewed", protect, markCommunicationViewed);
router.delete("/:id", protect, deleteCommunication);

export default router;
