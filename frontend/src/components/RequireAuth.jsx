import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function RequireAuth({ children }) {
  const { loading, me } = useAuth();
  if (loading) return null;
  if (!me) return <Navigate to="/" replace />;
  return children;
}
