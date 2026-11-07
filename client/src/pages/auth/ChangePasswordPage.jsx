import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Alert, Button, FieldWrap, Input } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { errorMessage } from "../../lib/api";

const ChangePasswordPage = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const forced = user?.mustChangePassword;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.newPassword !== form.confirm) return setError("The new passwords do not match");
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f7f1] p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{forced ? "Choose your password" : "Change password"}</h1>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        {forced && <Alert tone="info" className="mb-4">You signed in with a temporary password. Choose your own password to continue.</Alert>}
        <Alert tone="error" className="mb-4">{error}</Alert>
        <form onSubmit={submit} className="space-y-4">
          <FieldWrap label={forced ? "Temporary password" : "Current password"} htmlFor="current" required>
            <Input id="current" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set("currentPassword")} />
          </FieldWrap>
          <FieldWrap label="New password" htmlFor="new" required help="At least 10 characters, with letters and numbers">
            <Input id="new" type="password" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={set("newPassword")} />
          </FieldWrap>
          <FieldWrap label="Confirm new password" htmlFor="confirm" required>
            <Input id="confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")} />
          </FieldWrap>
          <Button type="submit" loading={saving} className="w-full">Save password</Button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          {forced ? <span /> : <Link to="/dashboard" className="text-primary-700 hover:underline">Back to dashboard</Link>}
          <button type="button" onClick={logout} className="text-slate-500 hover:text-slate-800">Sign out</button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
