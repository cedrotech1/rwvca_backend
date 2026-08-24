import express from "express";
import {
  getTodos,
  getTodo,
  createTodo,
  updateTodo,
  completeTodo,
  shareTodo,
  addTodoComment,
  deleteTodo,
} from "../controllers/todoController.js";
import { protect } from "../middlewares/protect.js";

const router = express.Router();

router.get("/", protect, getTodos);
router.get("/:id", protect, getTodo);
router.post("/", protect, createTodo);
router.put("/:id", protect, updateTodo);
router.post("/:id/complete", protect, completeTodo);
router.post("/:id/share", protect, shareTodo);
router.post("/:id/comments", protect, addTodoComment);
router.delete("/:id", protect, deleteTodo);

export default router;
