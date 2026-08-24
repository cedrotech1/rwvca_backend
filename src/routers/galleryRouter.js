import { createWebsiteRouter } from "../helpers/websiteCrud.js";

export default createWebsiteRouter("Gallery", {
  searchFields: ["title"],
  required: ["title", "url"],
  logAction: "gallery",
  fileField: { folder: "gallery", dbField: "url", prefix: "gallery", requiredOnCreate: true, label: "image" },
});
