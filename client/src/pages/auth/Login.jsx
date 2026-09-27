import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already logged in
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login(formData);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to log in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left branding section */}
        <div className="hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between">
          <div className="p-12">
            <div className="mb-12">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                KEIYIAN
              </h1>

              <p className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-primary-400">
                Farmers Cooperative Society
              </p>
            </div>

            <div className="max-w-lg">
              <h2 className="text-4xl font-bold leading-tight text-white">
                One platform for managing the entire cooperative.
              </h2>

              <p className="mt-6 text-lg leading-8 text-slate-300">
                Manage farmers, livestock, dairy operations, agriculture,
                finance, HR, procurement, inventory and healthcare from one
                integrated system.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 p-12">
            <p className="text-sm text-slate-400">
              Keiyian ERP & HMIS
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Integrated Cooperative Management Platform
            </p>
          </div>
        </div>

        {/* Login section */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="mb-10 text-center lg:hidden">
              <h1 className="text-3xl font-bold text-slate-900">
                KEIYIAN
              </h1>

              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
                Farmers Cooperative Society
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Sign in to your Keiyian ERP account.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email address
                  </label>

                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      autoComplete="email"
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((previous) => !previous)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Keiyian ERP & HMIS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;