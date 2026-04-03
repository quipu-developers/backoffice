const { AdminUser } = require("../models/admin");
const { Permission, WRITE_ALL_MASK } = require("../config/permissions");

async function bootstrapSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email) return;

  const superPerm = Permission.READ | WRITE_ALL_MASK;

  let user = await AdminUser.findOne({ email });
  if (!user) {
    await AdminUser.create({
      email,
      perm: superPerm,
      isSuperAdmin: true,
      isActive: true,
    });
    console.log("[LOG] super admin bootstrapped");
    return;
  }

  // Intentional bootstrap policy:
  // SUPER_ADMIN_EMAIL is always enforced with max admin permissions.
  // Manual perm downgrades are reverted on next server bootstrap.
  const needsUpdate = !user.isSuperAdmin || user.perm !== superPerm;
  if (needsUpdate) {
    user.isSuperAdmin = true;
    user.perm = superPerm;
    await user.save();
    console.log("[LOG] super admin elevated by bootstrap");
  }
}

module.exports = { bootstrapSuperAdmin };
