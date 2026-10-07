import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import {
  requestVerificationCode,
  verifyUserEmail,
} from "../../services/auth.service";

const VerifyAccountPage = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verified, setVerified] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your email.");
      return;
    }

    try {
      setBusy(true);
      const response = await verifyUserEmail({ email, code, password });
      setNotice(response.message || "Email verified. You can now sign in.");
      setVerified(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to verify this account. Check the code and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setNotice("");
    try {
      setResending(true);
      const response = await requestVerificationCode(email);
      setNotice(response.message || "If the account is awaiting verification, a new code has been sent.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to request a new code right now."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f3f7f1] px-5 py-8 text-[#19271f] sm:px-8 sm:py-12">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link to="/login" aria-label="Back to sign in" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-primary-800">
          <ArrowLeft size={17} /> Sign in
        </Link>
        <img
          src="/keiyian%20llogo.png"
          alt="Keiyian Farmers Cooperative Society"
          className="h-12 w-12 object-contain"
        />
      </header>

      <section className="mx-auto my-auto w-full max-w-md py-10">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-800">
          {verified ? <CheckCircle2 size={23} /> : <ShieldCheck size={23} />}
        </div>
        <p className="mb-3 text-[11px] font-semibold uppercase text-primary-800">Account activation</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {verified ? "Email verified" : "Verify your email"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {verified
            ? "Your account is ready. Sign in with the password you just created."
            : "Enter the code sent to your email, then choose a password for your account."}
        </p>

        {error && (
          <div role="alert" className="mt-6 rounded-md border border-red-200 border-l-2 border-l-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mt-6 rounded-md border border-emerald-200 border-l-2 border-l-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        )}

        {verified ? (
          <Link to="/login" className="mt-8 flex min-h-12 w-full items-center justify-center rounded-md bg-primary-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-2">
            Continue to sign in
          </Link>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Email address
                <span className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-400/20"
                    placeholder="Enter your invited email"
                  />
                </span>
              </label>

              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Six-digit verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-semibold tracking-[0.25em] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-400/20"
                  placeholder="000000"
                />
              </label>

              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Create password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-400/20"
                  placeholder="At least 12 characters"
                />
              </label>

              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-400/20"
                  placeholder="Re-enter your password"
                />
              </label>

              <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center rounded-md bg-primary-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? "Verifying..." : "Verify and activate account"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email.trim()}
              className="mt-4 w-full py-2 text-center text-sm font-medium text-primary-700 transition hover:text-primary-900 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              {resending ? "Requesting a new code..." : "Resend verification code"}
            </button>
          </>
        )}
      </section>

      <footer className="mx-auto w-full max-w-5xl border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        Developed &amp; Managed by{" "}
        <a href="https://payiani-technologies.vercel.app/" target="_blank" rel="noreferrer" className="font-bold text-primary-700 hover:text-primary-800 hover:underline">
          Payiani Technologies
        </a>
      </footer>
    </main>
  );
};

export default VerifyAccountPage;
