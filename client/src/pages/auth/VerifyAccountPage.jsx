import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Alert, Button, FieldWrap, Input } from "../../components/ui/ui";
import api, { errorMessage } from "../../lib/api";

// Used when an administrator changes a user's email address: the user
// enters the six-digit code sent to the new address.
const VerifyAccountPage = () => {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState({ tone: "info", text: "" });
  const [busy, setBusy] = useState("");

  const verify = async (event) => {
    event.preventDefault();
    setBusy("verify");
    try {
      const { data } = await api.post("/auth/verify-email", { email, code });
      setMessage({ tone: "success", text: data.data.message });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy("");
    }
  };

  const resend = async () => {
    setBusy("resend");
    try {
      const { data } = await api.post("/auth/resend-verification", { email });
      setMessage({ tone: "info", text: data.data.message });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f7f1] p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700"><MailCheck size={20} /></span>
          <h1 className="text-lg font-semibold text-slate-900">Verify your email</h1>
        </div>
        <Alert tone={message.tone} className="mb-4">{message.text}</Alert>
        <form onSubmit={verify} className="space-y-4">
          <FieldWrap label="Email" htmlFor="email" required>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="Six-digit code" htmlFor="code" required>
            <Input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </FieldWrap>
          <Button type="submit" loading={busy === "verify"} className="w-full">Verify</Button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <button type="button" disabled={!email || busy} onClick={resend} className="text-primary-700 hover:underline disabled:text-slate-400">Send a new code</button>
          <Link to="/login" className="text-slate-600 hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyAccountPage;
