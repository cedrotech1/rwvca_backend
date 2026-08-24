import express from "express";
import {
  getDocuments,
  getDocumentTypes,
  getDocument,
  getDocumentShareUsers,
  createDocument,
  updateDocument,
  downloadDocument,
  shareDocument,
  addDocumentComment,
  deleteDocument,
  updateDocumentStatus,
} from "../controllers/documentController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getDocuments);
router.get("/types", protect, getDocumentTypes);
router.get("/:id", protect, getDocument);
router.get("/:id/share-users", protect, getDocumentShareUsers);
router.get("/:id/file", protect, downloadDocument);
router.post("/", protect, createDocument);
router.put("/:id", protect, updateDocument);
router.post("/:id/share", protect, shareDocument);
router.post("/:id/status", protect, updateDocumentStatus);
router.post("/:id/comments", protect, addDocumentComment);
router.delete("/:id", protect, deleteDocument);

export default router;
