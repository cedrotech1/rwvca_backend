import { createWebsiteRouter } from "../helpers/websiteCrud.js";

export default createWebsiteRouter("Partners", {
  searchFields: ["logo_url"],
  required: ["logo_url"],
  statusField: null,
  logAction: "partners",
  fileField: { folder: "partners", dbField: "logo_url", prefix: "partner", requiredOnCreate: true, label: "logo" },
});
