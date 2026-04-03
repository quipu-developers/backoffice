const express = require("express");
const { upload, uploadHandler } = require("../controllers/uploadtoR2");
const { requireAuth, requirePerm } = require("../middlewares/boAuth");
const { Permission } = require("../config/permissions");

const router = express.Router();

router.post("/", requireAuth, requirePerm(Permission.WRITE_ACTIVITY), upload, uploadHandler);

module.exports = router;
