import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import landingImage from "../../assets/keiyian-landing.jpg";

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
    <div className="min-h-screen bg-[#f7f7f2] text-[#19271f] lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1.12fr)_minmax(430px,0.88fr)]">
      <section className="relative isolate flex min-h-[350px] flex-col justify-between overflow-hidden bg-emerald-950 px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 lg:py-12">
        <img
          src={landingImage}
          alt="Green agricultural fields beneath an open sky"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[#10251b]/45" />

        <div className="flex flex-col items-start gap-3">
          <img
            src="/keiyian%20llogo.png"
            alt="Keiyian Farmers Cooperative Society"
            className="h-14 w-64 rounded-sm bg-white px-3 py-1.5 object-contain object-left"
          />
        </div>

        <div className="mt-14 max-w-xl lg:mb-8">
          <p className="mb-4 text-xs font-semibold uppercase text-amber-300">
            Cooperative operations
          </p>
          <h1 className="max-w-lg font-serif text-4xl font-medium leading-tight sm:text-5xl lg:text-6xl">
            Keiyian Farmers Cooperative Society
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/80 sm:text-base">
            A shared workspace for member services and the day-to-day work of the cooperative.
          </p>
        </div>

        <div className="mt-10 hidden border-t border-white/25 pt-5 text-xs text-white/70 lg:block">
          Keiyian ERP &amp; HMIS
        </div>
      </section>

      <main className="flex min-h-[calc(100svh-350px)] flex-col border-t-4 border-amber-400 bg-[#fbfaf5] px-6 py-10 sm:px-10 lg:min-h-screen lg:border-l lg:border-t-0 lg:border-slate-200 lg:px-14 lg:py-12">
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-4">
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-0.5 w-8 bg-amber-600" />
              <p className="text-[11px] font-semibold uppercase text-amber-800">
                Staff access
              </p>
            </div>
            <h2 className="text-3xl font-semibold text-[#19271f] sm:text-4xl">
              Welcome back.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Sign in with your Keiyian cooperative account.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 rounded-md border border-red-200 border-l-2 border-l-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-[13px] font-semibold text-slate-700">
                Email address
              </label>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[13px] font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <footer className="mx-auto mt-6 w-full max-w-[390px] border-t border-slate-200 pt-4 text-center">
          <p className="text-[11px] text-slate-500">Keiyian ERP &amp; HMIS</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Developed &amp; Managed by{" "}
            <a
              href="https://payiani-technologies.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-amber-700 transition-colors hover:text-amber-800 hover:underline"
            >
              Payiani Technologies
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Login;