const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const path = require("path");

const router = require("./routers/index.js");
const {
  helmetMiddleware,
  cors,
  hpp,
  apiLimiter,
} = require("./middlewares/security.js");
const { serveUploads } = require("./middlewares/serveUploads.js");
const { errorHandler } = require("./middlewares/errorHandler.js");
const { requestAuditMiddleware } = require("./middlewares/auditLogger.js");
const { ensureUploadFolders } = require("./utils/fileStorage.js");

dotenv.config();
ensureUploadFolders();

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmetMiddleware);
app.use(cors);
app.use(hpp);
app.use(requestAuditMiddleware);
app.use(apiLimiter);

app.use(bodyParser.urlencoded({ extended: false, limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: true,
    tempFileDir: path.join(process.cwd(), "uploads", "tmp"),
  })
);

const filesHandler = serveUploads();
app.use("/uploads", filesHandler);
app.use("/api/v1/uploads", filesHandler);

app.use("/api/v1", router);

app.get("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "NOT_FOUND",
    code: "NOT_FOUND",
  });
});

app.use(errorHandler);

module.exports = app;
