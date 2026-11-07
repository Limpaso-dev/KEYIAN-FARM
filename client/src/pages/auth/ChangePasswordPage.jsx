import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Alert, Button, FieldWrap, Input } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { errorMessage } from "../../lib/api";
import { showError, toast } from "../../lib/toast";

const ChangePasswordPage = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [mismatch, setMismatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const forced = user?.mustChangePassword;

  const submit = async (event) => {
    event.preventDefault();
    setMismatch(false);
    if (form.newPassword !== form.confirm) return setMismatch(true);
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast("Your password has been changed");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      showError(errorMessage(err), "Could not change your password");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{forced ? "Choose your password" : "Change password"}</h1>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        {forced && <Alert tone="info" className="mb-4">You signed in with a temporary password. Choose your own password to continue.</Alert>}
        <form onSubmit={submit} className="space-y-4">
          <FieldWrap label={forced ? "Temporary password" : "Current password"} htmlFor="current" required>
            <Input id="current" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set("currentPassword")} />
          </FieldWrap>
          <FieldWrap label="New password" htmlFor="new" required help="At least 10 characters, with letters and numbers">
            <Input id="new" type="password" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={set("newPassword")} />
          </FieldWrap>
          <FieldWrap label="Confirm new password" htmlFor="confirm" required error={mismatch ? "The two new passwords do not match." : ""}>
            <Input id="confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => { setMismatch(false); set("confirm")(e); }} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "confirm-error" : undefined} className={mismatch ? "border-rose-400 focus:border-rose-500" : undefined} />
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
