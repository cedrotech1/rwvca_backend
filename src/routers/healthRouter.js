const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    service: "rwvca-backend",
    status: "ok",
    env: process.env.NODE_ENV || "development",
  });
});

module.exports = router;
