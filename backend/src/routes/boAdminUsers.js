const express = require("express");
const mongoose = require("mongoose");
const { requireAuth, requireSuperAdmin } = require("../middlewares/boAuth");
const { Permission } = require("../config/permissions");
const { labelsToPerm } = require("../utils/permLabels");
const { AdminUser, RefreshToken } = require("../models/admin");
const { writeAuditLog } = require("../services/auditLogService");

const router = express.Router();

router.get("/", requireAuth, requireSuperAdmin, async (_req, res) => {
  const users = await AdminUser.find({})
    .select("email name perm isSuperAdmin isActive lastLoginAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
  return res.json(users);
});

router.patch("/:id/perm", requireAuth, requireSuperAdmin, async (req, res) => {
  const { labels = [] } = req.body || {};
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await AdminUser.findById(req.params.id).session(session);
      if (!target) {
        const e = new Error("NOT_FOUND");
        e.status = 404;
        throw e;
      }

      const before = { perm: target.perm };
      target.perm = labelsToPerm(labels) | Permission.READ;
      await target.save({ session });

      await writeAuditLog({
        actorUserId: req.auth.userId,
        targetUserId: target._id,
        action: "ADMIN_PERM_CHANGED",
        before,
        after: { perm: target.perm },
        req,
        session,
      });
    });
  } catch (e) {
    if (e.message === "NOT_FOUND") return res.status(404).json({ code: "NOT_FOUND" });
    throw e;
  } finally {
    await session.endSession();
  }

  return res.json({ ok: true });
});

router.patch("/:id/active", requireAuth, requireSuperAdmin, async (req, res) => {
  const { isActive } = req.body || {};
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await AdminUser.findById(req.params.id).session(session);
      if (!target) {
        const e = new Error("NOT_FOUND");
        e.status = 404;
        throw e;
      }

      const before = { isActive: target.isActive };
      target.isActive = !!isActive;
      await target.save({ session });

      if (!target.isActive) {
        await RefreshToken.updateMany(
          { userId: target._id, revoked: false },
          { $set: { revoked: true, revokedAt: new Date() } },
          { session }
        );
      }

      await writeAuditLog({
        actorUserId: req.auth.userId,
        targetUserId: target._id,
        action: "ADMIN_ACTIVE_CHANGED",
        before,
        after: { isActive: target.isActive },
        req,
        session,
      });
    });
  } catch (e) {
    if (e.message === "NOT_FOUND") return res.status(404).json({ code: "NOT_FOUND" });
    throw e;
  } finally {
    await session.endSession();
  }

  return res.json({ ok: true });
});

router.patch("/:id/super-admin", requireAuth, requireSuperAdmin, async (req, res) => {
  const { isSuperAdmin } = req.body || {};
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const target = await AdminUser.findById(req.params.id).session(session);
      if (!target) {
        const e = new Error("NOT_FOUND");
        e.status = 404;
        throw e;
      }

      if (String(target._id) === req.auth.userId && isSuperAdmin === false) {
        const e = new Error("SELF_SUPER_ADMIN_DOWNGRADE_FORBIDDEN");
        e.status = 400;
        throw e;
      }

      if (target.isSuperAdmin && isSuperAdmin === false) {
        const count = await AdminUser.countDocuments({ isSuperAdmin: true }).session(session);
        if (count <= 1) {
          const e = new Error("LAST_SUPER_ADMIN_FORBIDDEN");
          e.status = 400;
          throw e;
        }
      }

      const before = { isSuperAdmin: target.isSuperAdmin };
      target.isSuperAdmin = !!isSuperAdmin;
      await target.save({ session });

      await writeAuditLog({
        actorUserId: req.auth.userId,
        targetUserId: target._id,
        action: "ADMIN_SUPER_ADMIN_CHANGED",
        before,
        after: { isSuperAdmin: target.isSuperAdmin },
        req,
        session,
      });
    });
  } catch (e) {
    if (e.message === "NOT_FOUND") return res.status(404).json({ code: "NOT_FOUND" });
    if (e.message === "SELF_SUPER_ADMIN_DOWNGRADE_FORBIDDEN") {
      return res.status(400).json({ code: "SELF_SUPER_ADMIN_DOWNGRADE_FORBIDDEN" });
    }
    if (e.message === "LAST_SUPER_ADMIN_FORBIDDEN") {
      return res.status(400).json({ code: "LAST_SUPER_ADMIN_FORBIDDEN" });
    }
    throw e;
  } finally {
    await session.endSession();
  }

  return res.json({ ok: true });
});

module.exports = router;
