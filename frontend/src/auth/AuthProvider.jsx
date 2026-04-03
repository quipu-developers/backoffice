import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import http, { bootstrapAuth } from "./authClient";
import { clearAccessToken } from "./tokenStore";

const AuthContext = createContext(null);
const authChannel = new BroadcastChannel("bo-auth");

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await bootstrapAuth();
      if (!mounted) return;

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await http.get("/bo/auth/me");
        if (mounted) setMe(res.data);
      } catch {
        clearAccessToken();
        if (mounted) setMe(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post("/bo/auth/logout");
    } catch (_e) {
      // logout best-effort: token cleanup continues even if request fails
    }
    clearAccessToken();
    authChannel.postMessage({ type: "LOGOUT" });
    setMe(null);
    navigate("/");
  }, [navigate]);

  const value = useMemo(() => ({ loading, me, setMe, logout }), [loading, me, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
