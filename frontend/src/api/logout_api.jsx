import http from "../auth/authClient";

export const logout = async () => {
  const response = await http.post("/bo/auth/logout");
  return response;
};
