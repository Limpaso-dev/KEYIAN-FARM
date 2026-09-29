import {
  useEffect,
  useState,
} from "react";
import authContext from "./AuthContextStore";

import {
  loginUser,
  getCurrentUser,
  logoutUser,
} from "../services/auth.service";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;

    const initializeAuth = async () => {
      const token = localStorage.getItem("keiyian_token");

      if (!token) {
        logoutUser();
        if (current) setLoading(false);
        return;
      }

      try {
        const response = await getCurrentUser();

        if (current) setUser(response.user);

        localStorage.setItem(
          "keiyian_user",
          JSON.stringify(response.user)
        );
      } catch {
        logoutUser();
        if (current) setUser(null);
      } finally {
        if (current) setLoading(false);
      }
    };

    const handleUnauthorized = () => {
      logoutUser();
      if (current) {
        setUser(null);
        setLoading(false);
      }
    };

    window.addEventListener("keiyian:unauthorized", handleUnauthorized);
    initializeAuth();

    return () => {
      current = false;
      window.removeEventListener("keiyian:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = async (credentials) => {
    const response = await loginUser(credentials);

    localStorage.setItem(
      "keiyian_token",
      response.token
    );

    localStorage.setItem(
      "keiyian_user",
      JSON.stringify(response.user)
    );

    setUser(response.user);

    return response;
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return (
    <authContext.Provider value={value}>
      {children}
    </authContext.Provider>
  );
};
