import "../style/login.css";
import React from "react";

const BASE_URL = process.env.REACT_APP_BACKEND_URL;

export default function Login() {
  const onGoogleLogin = () => {
    window.location.href = `${BASE_URL}/bo/auth/google`;
  };

  return (
    <div className="lg_container">
      <header className="lg_logo_Quipu">Quipu Admin</header>
      <div className="lg_box_login">
        <button onClick={onGoogleLogin}>Google로 로그인</button>
      </div>
    </div>
  );
}
