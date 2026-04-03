import React from "react";
import { useCan } from "../auth/useCan";

export default function Can({ mask, superAdminOnly = false, children, fallback = null }) {
  const { has, isSuperAdmin } = useCan();

  if (superAdminOnly && !isSuperAdmin) return fallback;
  if (mask && !has(mask)) return fallback;
  return children;
}
