import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  loginUser,
  getCurrentUser,
  logoutUser,
} from "../services/auth.service";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("keiyian_user");

    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("keiyian_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await getCurrentUser();

        setUser(response.user);

        localStorage.setItem(
          "keiyian_user",
          JSON.stringify(response.user)
        );
      } catch (error) {
        logoutUser();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
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
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};