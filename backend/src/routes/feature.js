const express = require("express");
const { checkRecruit, changeRecruit } = require("../controllers/recruit");
const { requireAuth, requirePerm } = require("../middlewares/boAuth");
const { Permission } = require("../config/permissions");

const router = express.Router();

router.get("/recruit", requireAuth, requirePerm(Permission.READ), checkRecruit);
router.patch(
  "/recruit",
  requireAuth,
  requirePerm(Permission.WRITE_RECRUIT_FORM),
  changeRecruit
);

router.get("/club-info", requireAuth, requirePerm(Permission.READ), (_req, res) => {
  return res.status(501).json({ code: "NOT_IMPLEMENTED" });
});

router.patch(
  "/club-info",
  requireAuth,
  requirePerm(Permission.WRITE_CLUB_INFO),
  (_req, res) => {
    return res.status(501).json({ code: "NOT_IMPLEMENTED" });
  }
);

module.exports = router;
