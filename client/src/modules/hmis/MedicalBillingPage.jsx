import { useEffect, useState } from "react";
import { BadgeDollarSign, ClipboardPlus, ReceiptText } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { getAccounts } from "../../services/account.service";
import { createMedicalBill, getMedicalBills, recordMedicalBillPayment } from "../../services/medicalBilling.service";
import { getMedicalVisits } from "../../services/medicalVisit.service";

const currency = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(amount) || 0);

const MedicalBillingPage = () => {
  const { user } = useAuth();
  const isFinance = ["finance", "admin", "super_admin"].includes(user?.role);
  const canCreateBill = ["doctor", "nurse", "admin", "super_admin"].includes(user?.role);
  const [bills, setBills] = useState([]);
  const [visits, setVisits] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ visit: "", description: "", quantity: 1, unitPrice: "" });
  const [payment, setPayment] = useState({ bill: "", amount: "", account: "", paymentMethod: "cash", reference: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const jobs = [getMedicalBills()];
      if (canCreateBill) jobs.push(getMedicalVisits());
      if (isFinance) jobs.push(getAccounts());
      const results = await Promise.all(jobs);
      setBills(results[0].data || []);
      if (canCreateBill) setVisits((results[1].data || []).filter((visit) => visit.status !== "cancelled"));
      if (isFinance) setAccounts((results[1].data || []).filter((account) => account.status === "active" && account.accountType === "asset"));
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not load HMIS billing records"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [isFinance, canCreateBill]);

  const submitBill = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await createMedicalBill({ visit: form.visit, items: [{ description: form.description, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }] });
      setForm({ visit: "", description: "", quantity: 1, unitPrice: "" }); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not send bill to Finance"); }
    finally { setSaving(false); }
  };

  const receivePayment = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await recordMedicalBillPayment(payment.bill, { amount: Number(payment.amount), account: payment.account, paymentMethod: payment.paymentMethod, reference: payment.reference });
      setPayment({ bill: "", amount: "", account: "", paymentMethod: "cash", reference: "" }); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not record patient payment"); }
    finally { setSaving(false); }
  };

  const payable = bills.filter((bill) => ["approved", "partially_paid"].includes(bill.status));
  const selectedBill = payable.find((bill) => bill._id === payment.bill);
  const balance = selectedBill ? Math.max(selectedBill.totalAmount - selectedBill.amountPaid, 0) : 0;

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-rose-100 p-3 text-rose-700"><ReceiptText size={22}/></div><div><h1 className="text-2xl font-bold text-slate-900">HMIS billing</h1><p className="text-sm text-slate-500">Clinical charges go to Finance for approval. Approved balances can be collected and posted to accounts.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {canCreateBill && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><ClipboardPlus size={18}/>Create a patient bill</h2><form onSubmit={submitBill} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Medical visit<select className="form-input mt-1" value={form.visit} onChange={(event) => setForm({ ...form, visit: event.target.value })} required><option value="">Select visit</option>{visits.map((visit) => <option key={visit._id} value={visit._id}>{visit.patient?.patientNumber} Â· {new Date(visit.visitDate).toLocaleDateString()} Â· {visit.visitType}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Charge description<input className="form-input mt-1" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required placeholder="Consultation, lab test, medicine"/></label><label className="text-sm font-medium text-slate-700">Quantity<input className="form-input mt-1" type="number" min="0.01" step="any" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required/></label><label className="text-sm font-medium text-slate-700">Unit charge (KES)<input className="form-input mt-1" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} required/></label><div className="flex items-end justify-end md:col-span-2"><button disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Submittingâ€¦" : "Send bill to Finance"}</button></div></form></section>}
    {isFinance && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><BadgeDollarSign size={18}/>Record a patient payment</h2><form onSubmit={receivePayment} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Approved patient bill<select className="form-input mt-1" value={payment.bill} onChange={(event) => setPayment({ ...payment, bill: event.target.value })} required><option value="">Select bill</option>{payable.map((bill) => <option key={bill._id} value={bill._id}>{bill.billNumber} Â· Patient {bill.patient?.patientNumber} Â· {currency(bill.totalAmount - bill.amountPaid)}</option>)}</select></label><div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Balance due<strong className="mt-1 block text-lg text-slate-900">{currency(balance)}</strong></div><label className="text-sm font-medium text-slate-700">Amount received<input className="form-input mt-1" type="number" min="0.01" max={balance} step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} required/></label><label className="text-sm font-medium text-slate-700">Deposit account<select className="form-input mt-1" value={payment.account} onChange={(event) => setPayment({ ...payment, account: event.target.value })} required><option value="">Select account</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} Â· {account.accountName}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Payment method<select className="form-input mt-1" value={payment.paymentMethod} onChange={(event) => setPayment({ ...payment, paymentMethod: event.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label className="text-sm font-medium text-slate-700">Payment reference<input className="form-input mt-1" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} required/></label><div className="flex items-end justify-end md:col-span-2"><button disabled={saving || !selectedBill} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Recordingâ€¦" : "Record payment and post receipt"}</button></div></form></section>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 font-semibold text-slate-900">Patient bills and approval history</div>{loading ? <div className="p-6 text-sm text-slate-500">Loading billsâ€¦</div> : bills.length === 0 ? <div className="p-6 text-sm text-slate-500">No bills in this view.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["Bill", "Patient number", "Visit", "Charges", "Amount", "Paid", "Balance", "Status"].map((heading) => <th key={heading} className="p-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{bills.map((bill) => <tr key={bill._id} className="border-t"><td className="p-3 font-semibold">{bill.billNumber}</td><td className="p-3">{bill.patient?.patientNumber}</td><td className="p-3">{bill.visit?.visitType} Â· {bill.visit?.visitDate && new Date(bill.visit.visitDate).toLocaleDateString()}</td><td className="p-3">{bill.items?.map((item) => item.description).join(", ")}</td><td className="p-3">{currency(bill.totalAmount)}</td><td className="p-3">{currency(bill.amountPaid)}</td><td className="p-3">{currency(bill.totalAmount - bill.amountPaid)}</td><td className="p-3 capitalize">{bill.status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>}</section>
  </div>;
};

export default MedicalBillingPage;
