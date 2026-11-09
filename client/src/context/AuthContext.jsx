import { useCallback, useEffect, useMemo, useState } from "react";
import authContext from "./AuthContextStore";
import api, { get } from "../lib/api";
import { forgetToken, restoreToken, saveToken } from "../lib/session";
import { clearFetchCache } from "../lib/useFetch";

// The sign-in lasts while the site is open: closing the last tab or the
// browser ends it (see lib/session.js).
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null); // { user, permissions }
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drops the signed-in state; the token is forgotten by whoever ends the session.
  const clear = useCallback(() => {
    clearFetchCache();
    setSession(null);
  }, []);

  /** Sign out here and in the site's other open tabs. */
  const logout = useCallback(() => {
    forgetToken({ everywhere: true });
    clear();
  }, [clear]);

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await get("/meta"));
    } catch {
      // Not fatal: labels fall back to raw values. It is loaded again after
      // a password change.
      setMeta({});
    }
  }, []);

  useEffect(() => {
    let current = true;
    const init = async () => {
      const token = await restoreToken();
      if (!current) return;
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await get("/auth/me");
        if (!current) return;
        setSession(data);
        if (!data.user.mustChangePassword) await loadMeta();
      } catch {
        if (current) {
          forgetToken();
          clear();
        }
      } finally {
        if (current) setLoading(false);
      }
    };
    const onUnauthorized = () => {
      clear();
      setLoading(false);
    };
    const onPasswordChange = () =>
      setSession((previous) => (previous ? { ...previous, user: { ...previous.user, mustChangePassword: true } } : previous));
    window.addEventListener("keiyian:unauthorized", onUnauthorized);
    window.addEventListener("keiyian:password-change", onPasswordChange);
    init();
    return () => {
      current = false;
      window.removeEventListener("keiyian:unauthorized", onUnauthorized);
      window.removeEventListener("keiyian:password-change", onPasswordChange);
    };
  }, [clear, loadMeta]);

  const login = useCallback(async (credentials) => {
    const { data } = (await api.post("/auth/login", credentials)).data;
    saveToken(data.token);
    setSession({ user: data.user, permissions: data.permissions });
    if (!data.user.mustChangePassword) await loadMeta();
    return data;
  }, [loadMeta]);

  const changePassword = useCallback(async (body) => {
    const { data } = (await api.post("/auth/change-password", body)).data;
    setSession(data);
    await loadMeta();
    return data;
  }, [loadMeta]);

  const value = useMemo(() => {
    const permissions = session?.permissions;
    /** can("animals", "write") using the server-computed permission map. */
    const can = (resource, action = "read") => Boolean(permissions?.resources?.[resource]?.[action]);
    /** Label for a value from one of the server's option lists. */
    const label = (list, value) => meta?.[list]?.find((o) => o.value === value)?.label ?? (value ?? "");
    return {
      user: session?.user ?? null,
      permissions,
      meta,
      loading,
      isAuthenticated: Boolean(session?.user),
      can,
      label,
      login,
      logout,
      changePassword,
    };
  }, [session, meta, loading, login, logout, changePassword]);

  return <authContext.Provider value={value}>{children}</authContext.Provider>;
};
