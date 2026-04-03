import "./App.css";
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RecruitDB from "./page/recruitDB";
import Login from "./page/login";
import AuthCallback from "./page/AuthCallback";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./auth/AuthProvider";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <div className="container">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/recruitDB"
              element={
                <RequireAuth>
                  <RecruitDB />
                </RequireAuth>
              }
            />
          </Routes>
          <Toaster />
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
