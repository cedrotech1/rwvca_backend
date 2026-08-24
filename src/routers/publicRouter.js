import express from "express";
import {
  getPublicAds,
  getPublicEvents,
  getPublicEvent,
  getPublicPrograms,
  getPublicProgram,
  getPublicGallery,
  getPublicPartners,
  getPublicTeam,
  getPublicCompany,
  getPublicOrganization,
  getPublicPlatforms,
  getPublicPlatform,
  getPublicMemberProducts,
  getPublicApplicationSettings,
  getPublicMembership,
  createContactMessage,
  subscribe,
} from "../controllers/publicController.js";

const router = express.Router();

router.get("/ads", getPublicAds);
router.get("/events", getPublicEvents);
router.get("/events/:id", getPublicEvent);
router.get("/programs", getPublicPrograms);
router.get("/programs/:id", getPublicProgram);
router.get("/gallery", getPublicGallery);
router.get("/partners", getPublicPartners);
router.get("/team", getPublicTeam);
router.get("/company", getPublicCompany);
router.get("/organization", getPublicOrganization);
router.get("/platforms", getPublicPlatforms);
router.get("/platforms/:id", getPublicPlatform);
router.get("/member-products", getPublicMemberProducts);
router.get("/membership-application", getPublicApplicationSettings);
router.get("/membership", getPublicMembership);
router.post("/contact", createContactMessage);
router.post("/subscribe", subscribe);

export default router;
