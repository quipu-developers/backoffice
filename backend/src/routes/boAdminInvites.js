const express = require("express");
const mongoose = require("mongoose");
const { requireAuth, requireSuperAdmin } = require("../middlewares/boAuth");
const { Permission } = require("../config/permissions");
const { labelsToPerm } = require("../utils/permLabels");
const { randomToken, sha256 } = require("../utils/cryptoUtil");
const { AdminInvite } = require("../models/admin");
const { writeAuditLog } = require("../services/auditLogService");

const router = express.Router();
const INVITE_STATUSES = new Set(["pending", "used", "expired", "revoked"]);

router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const query = {};
  if (typeof req.query?.status === "string" && INVITE_STATUSES.has(req.query.status)) {
    query.status = req.query.status;
  }

  const invites = await AdminInvite.find(query)
    .select("email perm status expiresAt invitedBy usedByUserId createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean();
  return res.json(invites);
});

router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const { email, perm, labels = ["read/all"], expiresInSec = 172800 } = req.body || {};
  if (!email) return res.status(400).json({ code: "INVALID_INPUT" });
  if (expiresInSec < 3600 || expiresInSec > 604800) {
    return res.status(400).json({ code: "INVALID_EXPIRES" });
  }

  let invitePerm;
  if (Number.isInteger(perm) && perm >= 0) {
    invitePerm = perm | Permission.READ;
  } else {
    invitePerm = labelsToPerm(labels) | Permission.READ;
  }
  const token = randomToken(32);
  const tokenHash = sha256(token);
  const normEmail = String(email).trim().toLowerCase();

  await AdminInvite.updateMany({ email: normEmail, status: "pending" }, { $set: { status: "revoked" } });

  const invite = await AdminInvite.create({
    email: normEmail,
    perm: invitePerm,
    tokenHash,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
    invitedBy: req.auth.userId,
  });

  await writeAuditLog({
    actorUserId: req.auth.userId,
    action: "ADMIN_INVITE_CREATED",
    after: { inviteId: String(invite._id), email: normEmail, perm: invitePerm, expiresInSec },
    req,
  });

  return res.status(201).json({
    inviteUrl: `${process.env.BO_BACKEND_URL}/bo/auth/invite/${token}`,
  });
});

router.patch("/:id/revoke", requireAuth, requireSuperAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const invite = await AdminInvite.findById(req.params.id).session(session);
      if (!invite) {
        const e = new Error("NOT_FOUND");
        e.status = 404;
        throw e;
      }
      if (invite.status !== "pending") {
        const e = new Error("INVITE_NOT_PENDING");
        e.status = 409;
        throw e;
      }

      invite.status = "revoked";
      await invite.save({ session });

      await writeAuditLog({
        actorUserId: req.auth.userId,
        action: "ADMIN_INVITE_REVOKED",
        after: { inviteId: String(invite._id), email: invite.email },
        req,
        session,
      });
    });
  } catch (e) {
    if (e.message === "NOT_FOUND") return res.status(404).json({ code: "NOT_FOUND" });
    if (e.message === "INVITE_NOT_PENDING") return res.status(409).json({ code: "INVITE_NOT_PENDING" });
    throw e;
  } finally {
    await session.endSession();
  }

  return res.json({ ok: true });
});

router.post("/:id/reissue", requireAuth, requireSuperAdmin, async (req, res) => {
  const { perm, labels, expiresInSec = 172800 } = req.body || {};
  if (expiresInSec < 3600 || expiresInSec > 604800) {
    return res.status(400).json({ code: "INVALID_EXPIRES" });
  }

  const session = await mongoose.startSession();
  let inviteUrl;
  try {
    await session.withTransaction(async () => {
      const baseInvite = await AdminInvite.findById(req.params.id).session(session);
      if (!baseInvite) {
        const e = new Error("NOT_FOUND");
        e.status = 404;
        throw e;
      }

      await AdminInvite.updateMany(
        { email: baseInvite.email, status: "pending" },
        { $set: { status: "revoked" } },
        { session }
      );

      let invitePerm;
      if (Number.isInteger(perm) && perm >= 0) {
        invitePerm = perm | Permission.READ;
      } else if (Array.isArray(labels)) {
        invitePerm = labelsToPerm(labels) | Permission.READ;
      } else {
        invitePerm = baseInvite.perm | Permission.READ;
      }

      const token = randomToken(32);
      const tokenHash = sha256(token);
      const created = await AdminInvite.create(
        [
          {
            email: baseInvite.email,
            perm: invitePerm,
            tokenHash,
            expiresAt: new Date(Date.now() + expiresInSec * 1000),
            invitedBy: req.auth.userId,
          },
        ],
        { session }
      ).then((arr) => arr[0]);

      await writeAuditLog({
        actorUserId: req.auth.userId,
        action: "ADMIN_INVITE_REISSUED",
        after: {
          sourceInviteId: String(baseInvite._id),
          newInviteId: String(created._id),
          email: created.email,
          perm: created.perm,
          expiresInSec,
        },
        req,
        session,
      });

      inviteUrl = `${process.env.BO_BACKEND_URL}/bo/auth/invite/${token}`;
    });
  } catch (e) {
    if (e.message === "NOT_FOUND") return res.status(404).json({ code: "NOT_FOUND" });
    throw e;
  } finally {
    await session.endSession();
  }

  return res.status(201).json({ inviteUrl });
});

module.exports = router;
