import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import { errorMessage } from "../../lib/api";
import { dismissError, showError } from "../../lib/toast";
import landingImage from "../../assets/keiyian-landing.jpg";

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  // Every sign-in starts on the dashboard, whoever was signed in before and
  // whichever page they were on.
  const homePath = user?.mustChangePassword ? "/change-password" : "/dashboard";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in
  if (isAuthenticated) {
    return <Navigate to={homePath} replace />;
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

    dismissError();
    setLoading(true);

    try {
      const session = await login(formData);
      // Leave nothing behind in the form for the next person at this screen.
      setFormData({ email: "", password: "" });
      setShowPassword(false);
      navigate(session.user?.mustChangePassword ? "/change-password" : "/dashboard", { replace: true });
    } catch (error) {
      setFormData((previous) => ({ ...previous, password: "" }));
      showError(errorMessage(error, "Unable to sign in. Please check your email and password."), "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1.12fr)_minmax(430px,0.88fr)]">
      <section className="relative isolate flex min-h-[350px] flex-col justify-between overflow-hidden bg-emerald-950 px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 lg:py-12">
        <img
          src={landingImage}
          alt="Green agricultural fields beneath an open sky"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-sidebar/45" />

        <div className="flex w-full flex-col items-center gap-3">
          <img
            src="/keiyian%20llogo.png"
            alt="Keiyian Farmers Cooperative Society"
            className="h-16 w-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          />
        </div>

        <div className="mt-14 max-w-xl lg:mb-8">
          <p className="mb-4 text-xs font-semibold uppercase text-primary-200">
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
          Nuru ya Jamii
        </div>
      </section>

      <main className="flex min-h-[calc(100svh-350px)] flex-col border-t-4 border-primary-300 bg-slate-50 px-6 py-10 sm:px-10 lg:min-h-screen lg:border-l lg:border-t-0 lg:border-slate-200 lg:px-14 lg:py-12">
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-4">
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-0.5 w-8 bg-primary-600" />
              <p className="text-[11px] font-semibold uppercase text-primary-800">
                Staff access
              </p>
            </div>
            <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Welcome back.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Sign in with your Keiyian cooperative account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
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
                  autoComplete="off"
                  required
                  className="w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-400/20"
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
                  autoComplete="off"
                  required
                  className="w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <footer className="mx-auto mt-6 w-full max-w-[390px] border-t border-slate-200 pt-4 text-center">
          <p className="text-[11px] text-slate-500">Keiyian Farmers Cooperative Society Ltd</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Developed &amp; Managed by{" "}
            <a
              href="https://payiani-technologies.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-primary-700 transition-colors hover:text-primary-800 hover:underline"
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
