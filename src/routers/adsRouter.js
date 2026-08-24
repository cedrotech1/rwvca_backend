import { createWebsiteRouter } from "../helpers/websiteCrud.js";

export default createWebsiteRouter("Ads", {
  searchFields: ["title", "description"],
  required: ["title", "description", "url"],
  logAction: "ads",
  fileField: { folder: "ads", dbField: "url", prefix: "ads", requiredOnCreate: true, label: "image" },
});
