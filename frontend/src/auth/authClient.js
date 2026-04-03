import axios from "axios";
import { getAccessToken, setAccessToken, clearAccessToken } from "./tokenStore";

const BASE_URL = process.env.REACT_APP_BACKEND_URL;

const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

const channel = new BroadcastChannel("bo-auth");
let refreshPromise = null;

channel.onmessage = (e) => {
  if (e.data?.type === "TOKEN_REFRESHED") {
    setAccessToken(e.data.accessToken);
    refreshPromise = null;
  }
  if (e.data?.type === "LOGOUT") {
    clearAccessToken();
    refreshPromise = null;
    const alreadyOnExpiredPage =
      window.location.pathname === "/" && window.location.search.includes("reason=session_expired");
    if (!alreadyOnExpiredPage) {
      window.location.replace("/?reason=session_expired");
    }
  }
};

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function refreshAccessToken() {
  const res = await axios.post(
    `${BASE_URL}/bo/auth/refresh`,
    {},
    {
      withCredentials: true,
      headers: { "X-Requested-With": "XMLHttpRequest" },
    }
  );
  const token = res.data.accessToken;
  setAccessToken(token);
  channel.postMessage({ type: "TOKEN_REFRESHED", accessToken: token });
  return token;
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const code = error.response?.data?.code;
    const status = error.response?.status;
    const isRefreshCall = (original?.url || "").includes("/bo/auth/refresh");

    if (status !== 401 || original?._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    if (
      code === "REFRESH_TOKEN_REUSE_DETECTED" ||
      code === "REFRESH_TOKEN_INVALID" ||
      code === "REFRESH_TOKEN_INVALID_OR_USED" ||
      code === "REFRESH_TOKEN_EXPIRED"
    ) {
      clearAccessToken();
      channel.postMessage({ type: "LOGOUT" });
      window.location.replace("/?reason=session_expired");
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    original.headers.Authorization = `Bearer ${newToken}`;
    return http(original);
  }
);

export async function bootstrapAuth() {
  try {
    const token = await refreshAccessToken();
    return token;
  } catch {
    clearAccessToken();
    return null;
  }
}

export default http;
