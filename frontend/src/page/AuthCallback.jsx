import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { setAccessToken } from "../auth/tokenStore";
import http from "../auth/authClient";
import { useAuth } from "../auth/AuthProvider";

const BASE_URL = process.env.REACT_APP_BACKEND_URL;

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setMe } = useAuth();

  useEffect(() => {
    const code = params.get("code");
    if (!code) {
      navigate("/?reason=missing_code");
      return;
    }

    axios
      .post(`${BASE_URL}/bo/auth/token-exchange`, { code }, { withCredentials: true })
      .then(async (res) => {
        setAccessToken(res.data.accessToken);
        const meRes = await http.get("/bo/auth/me");
        setMe(meRes.data);
        navigate("/recruitDB");
      })
      .catch((err) => {
        const code = err?.response?.data?.code;
        const reasonMap = {
          OAUTH_STATE_INVALID: "oauth_state_invalid",
          OAUTH_CLAIMS_INVALID: "oauth_claims_invalid",
          INVITE_EMAIL_MISMATCH: "invite_email_mismatch",
          ACCOUNT_INACTIVE: "account_inactive",
          INVITE_EXPIRED: "invite_expired",
          INVITE_REVOKED: "invite_revoked",
          INVITE_ALREADY_USED: "invite_already_used",
          EMAIL_NOT_VERIFIED: "email_not_verified",
          GOOGLE_SUB_CONFLICT: "google_sub_conflict",
        };
        const reason = reasonMap[code] || "auth_failed";
        navigate(`/?reason=${reason}`);
      });
  }, [params, navigate, setMe]);

  return null;
}
