import express from "express";
import { getEdNotes, getEdNote, createEdNote, replyEdNote } from "../controllers/edNoteController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getEdNotes);
router.get("/:id", protect, getEdNote);
router.post("/", protect, createEdNote);
router.post("/:id/replies", protect, replyEdNote);

export default router;
