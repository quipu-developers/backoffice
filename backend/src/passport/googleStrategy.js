const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const mongoose = require("mongoose");
const { AdminUser, AdminInvite } = require("../models/admin");
const { Permission } = require("../config/permissions");
const { sha256 } = require("../utils/cryptoUtil");
const { writeAuditLog } = require("../services/auditLogService");

async function verifyGoogleTokenClaims(accessToken) {
  if (!accessToken) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return false;

    const payload = await res.json();
    const aud = payload.aud || payload.azp || payload.issued_to;
    const iss = payload.iss || payload.issuer;
    const validAud = aud === process.env.GOOGLE_CLIENT_ID;
    const validIss =
      !iss || iss === "accounts.google.com" || iss === "https://accounts.google.com";
    return validAud && validIss;
  } catch (_e) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = function configureGoogleStrategy() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BO_BACKEND_URL}/bo/auth/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, _refreshToken, profile, done) => {
        const email = (profile.emails?.[0]?.value || "").trim().toLowerCase();
        const emailVerified =
          profile._json?.email_verified === true || profile.emails?.[0]?.verified === true;
        const googleSub = profile.id;
        const name = profile.displayName || "";
        const pictureUrl = profile.photos?.[0]?.value || "";

        try {
          const oauthClaimsValid = await verifyGoogleTokenClaims(accessToken);
          if (!oauthClaimsValid) return done(null, false, { message: "OAUTH_CLAIMS_INVALID" });
          if (!emailVerified) return done(null, false, { message: "EMAIL_NOT_VERIFIED" });

          let user = await AdminUser.findOne({ googleSub });
          if (user) {
            if (!user.isActive) return done(null, false, { message: "ACCOUNT_INACTIVE" });
            user.lastLoginAt = new Date();
            await user.save();
            return done(null, user);
          }

          const inviteRawToken = req.signedCookies.bo_invite_token;
          if (!inviteRawToken) return done(null, false, { message: "INVITE_REQUIRED" });
          const inviteHash = sha256(inviteRawToken);

          const invite = await AdminInvite.findOne({ tokenHash: inviteHash });
          if (!invite) return done(null, false, { message: "INVITE_INVALID" });

          if (invite.status === "used") return done(null, false, { message: "INVITE_ALREADY_USED" });
          if (invite.status === "revoked") return done(null, false, { message: "INVITE_REVOKED" });
          if (invite.status !== "pending") return done(null, false, { message: "INVITE_INVALID" });
          if (invite.expiresAt < new Date()) return done(null, false, { message: "INVITE_EXPIRED" });
          if (invite.email !== email) return done(null, false, { message: "INVITE_EMAIL_MISMATCH" });

          const existingByEmail = await AdminUser.findOne({ email });
          if (existingByEmail?.googleSub && existingByEmail.googleSub !== googleSub) {
            return done(null, false, { message: "GOOGLE_SUB_CONFLICT" });
          }

          const session = await mongoose.startSession();
          let createdUser;
          try {
            await session.withTransaction(async () => {
              if (existingByEmail) {
                existingByEmail.googleSub = googleSub;
                existingByEmail.name = name;
                existingByEmail.pictureUrl = pictureUrl;
                existingByEmail.perm = invite.perm | Permission.READ;
                existingByEmail.isActive = true;
                existingByEmail.lastLoginAt = new Date();
                await existingByEmail.save({ session });
                createdUser = existingByEmail;
              } else {
                createdUser = await AdminUser.create(
                  [
                    {
                      email,
                      googleSub,
                      name,
                      pictureUrl,
                      perm: invite.perm | Permission.READ,
                      isActive: true,
                      lastLoginAt: new Date(),
                    },
                  ],
                  { session }
                ).then((arr) => arr[0]);
              }

              invite.status = "used";
              invite.usedByUserId = createdUser._id;
              await invite.save({ session });

              await writeAuditLog({
                actorUserId: createdUser._id,
                targetUserId: createdUser._id,
                action: "ADMIN_INVITE_ACCEPTED",
                after: {
                  email,
                  perm: createdUser.perm,
                  inviteId: String(invite._id),
                },
                req,
                session,
              });
            });
          } finally {
            await session.endSession();
          }

          return done(null, createdUser);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
};
