import { useCallback, useEffect, useMemo, useState } from "react";
import authContext from "./AuthContextStore";
import api, { get, TOKEN_KEY } from "../lib/api";
import { clearFetchCache } from "../lib/useFetch";

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null); // { user, permissions }
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("keiyian_user");
    clearFetchCache();
    setSession(null);
  }, []);

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
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }
      try {
        const data = await get("/auth/me");
        if (!current) return;
        setSession(data);
        if (!data.user.mustChangePassword) await loadMeta();
      } catch {
        if (current) clear();
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
    localStorage.setItem(TOKEN_KEY, data.token);
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
      logout: clear,
      changePassword,
    };
  }, [session, meta, loading, login, clear, changePassword]);

  return <authContext.Provider value={value}>{children}</authContext.Provider>;
};
