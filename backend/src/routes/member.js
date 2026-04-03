const express = require("express");
const { Member } = require("../models/mongo");
const getData = require("../controllers/getdata");
const getPDF = require("../controllers/getpdf");
const { requireAuth, requirePerm } = require("../middlewares/boAuth");
const { Permission } = require("../config/permissions");

const router = express.Router();

router.get("/", requireAuth, requirePerm(Permission.READ), getData(Member));
router.get("/pdf/:filename", requireAuth, requirePerm(Permission.READ), getPDF);

module.exports = router;
