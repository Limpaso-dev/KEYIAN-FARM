import { useEffect, useState } from "react";
import { BadgeDollarSign, ClipboardPlus, ReceiptText } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import PatientProfilePanel from "../../components/hmis/PatientProfilePanel";
import { getAccounts } from "../../services/account.service";
import { createMedicalBill, getBillableMedicalVisits, getMedicalBills, getMedicalPaymentAccounts, recordMedicalBillPayment } from "../../services/medicalBilling.service";

const currency = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(amount) || 0);

const MedicalBillingPage = () => {
  const { user } = useAuth();
  const isFinance = ["finance", "cashier", "admin", "super_admin"].includes(user?.role);
  const canManageAccounts = ["finance", "admin", "super_admin"].includes(user?.role);
  const isPharmacy = ["pharmacist", "pharmacy"].includes(user?.role);
  const canCreateBill = ["doctor", "pharmacist", "pharmacy", "admin", "super_admin"].includes(user?.role);
  const canAddExtraCharge = ["doctor", "nurse", "admin", "super_admin"].includes(user?.role);
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
      const visitIndex = jobs.push(getBillableMedicalVisits()) - 1;
      const accountsIndex = isFinance
        ? jobs.push(canManageAccounts ? getAccounts() : getMedicalPaymentAccounts()) - 1
        : -1;
      const results = await Promise.all(jobs);
      setBills(results[0].data || []);
      setVisits(results[visitIndex].data || []);
      if (accountsIndex >= 0) {
        const availableAccounts = results[accountsIndex].data || [];
        setAccounts(canManageAccounts
          ? availableAccounts.filter((account) => account.status === "active" && account.accountType === "asset")
          : availableAccounts);
      }
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not load HMIS billing records"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [isFinance, canCreateBill]);

  const submitBill = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const items = form.description.trim() ? [{ description: form.description, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }] : [];
      await createMedicalBill({ visit: form.visit, items });
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
  const visitBillGroups = Object.values(bills.reduce((groups, bill) => {
    const visitId = bill.visit?._id || bill.visit || bill._id;
    if (!groups[visitId]) groups[visitId] = { key: visitId, patientNumber: bill.patient?.patientNumber, visit: bill.visit, bills: [], totalAmount: 0, amountPaid: 0 };
    groups[visitId].bills.push(bill);
    groups[visitId].totalAmount += Number(bill.totalAmount || 0);
    groups[visitId].amountPaid += Number(bill.amountPaid || 0);
    return groups;
  }, {})).sort((a, b) => new Date(b.visit?.visitDate || 0) - new Date(a.visit?.visitDate || 0));
  const selectedBill = payable.find((bill) => bill._id === payment.bill);
  const isCashPayment = payment.paymentMethod === "cash";
  const balance = selectedBill ? Math.max(selectedBill.totalAmount - selectedBill.amountPaid, 0) : 0;

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-rose-100 p-3 text-rose-700"><ReceiptText size={22}/></div><div><h1 className="text-2xl font-bold text-slate-900">HMIS billing</h1><p className="text-sm text-slate-500">Consultation, laboratory, and pharmacy charges are combined by visit and sent to the cashier for collection.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {isFinance && selectedBill && <PatientProfilePanel patient={selectedBill.patient} />}
    {isFinance && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 font-semibold text-slate-900">Combined patient totals by visit</div>{loading ? <div className="p-6 text-sm text-slate-500">Loading visit totals…</div> : visitBillGroups.length === 0 ? <div className="p-6 text-sm text-slate-500">No patient bills are available.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["Patient", "Visit", "Departments billed", "Combined total", "Paid", "Balance due"].map((heading) => <th key={heading} className="p-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{visitBillGroups.map((group) => <tr key={group.key} className="border-t"><td className="p-3 font-semibold">{group.patientNumber || "—"}</td><td className="p-3">{group.visit?.visitNumber || group.visit?.visitType || "Visit"}<div className="text-xs text-slate-500">{group.visit?.visitDate && new Date(group.visit.visitDate).toLocaleDateString()}</div></td><td className="p-3">{group.bills.map((bill) => bill.department || "HMIS").join(", ")}</td><td className="p-3 font-semibold">{currency(group.totalAmount)}</td><td className="p-3">{currency(group.amountPaid)}</td><td className="p-3 font-semibold">{currency(Math.max(group.totalAmount - group.amountPaid, 0))}</td></tr>)}</tbody></table></div>}</section>}
    {isFinance && visits.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 font-semibold text-slate-900">Visits awaiting billing</div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["Patient number", "Visit number", "Visit type", "Visit date", "Status"].map((heading) => <th className="p-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead><tbody>{visits.map((visit) => <tr key={visit._id} className="border-t"><td className="p-3">{visit.patient?.patientNumber}</td><td className="p-3">{visit.visitNumber || "—"}</td><td className="p-3 capitalize">{visit.visitType?.replaceAll("_", " ")}</td><td className="p-3">{new Date(visit.visitDate).toLocaleDateString()}</td><td className="p-3 capitalize">{visit.status?.replaceAll("_", " ")}</td></tr>)}</tbody></table></div></section>}
    {canCreateBill && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><ClipboardPlus size={18}/>{isPharmacy ? "Send pharmacy bill to cashier" : "Send doctor bill to cashier"}</h2><p className="mb-4 text-sm text-slate-500">{isPharmacy ? "Review the doctor's prescription, select the same patient visit, then send the prescribed medicine charges to the cashier." : "Select the patient visit after consultation and any requested lab work. Consultation and completed lab charges will be billed."}</p><form onSubmit={submitBill} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Patient visit<select className="form-input mt-1" value={form.visit} onChange={(event) => setForm({ ...form, visit: event.target.value })} required><option value="">Select visit</option>{visits.map((visit) => <option key={visit._id} value={visit._id}>{visit.patient?.patientNumber} · {visit.visitNumber || visit.visitType} · {new Date(visit.visitDate).toLocaleDateString()}</option>)}</select></label>{canAddExtraCharge && <><label className="text-sm font-medium text-slate-700">Extra charge description (optional)<input className="form-input mt-1" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Additional service"/></label><label className="text-sm font-medium text-slate-700">Extra quantity<input className="form-input mt-1" type="number" min="0.01" step="any" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/></label><label className="text-sm font-medium text-slate-700">Extra unit charge (KES)<input className="form-input mt-1" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })}/></label></>}<div className="flex items-end justify-end md:col-span-2"><button disabled={saving || visits.length === 0} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Sending…" : isPharmacy ? "Send pharmacy bill" : "Send doctor bill"}</button></div></form>{visits.length === 0 && <p className="mt-3 text-sm text-slate-500">{isPharmacy ? "No visits are awaiting a pharmacy bill." : "No visits are awaiting a doctor bill."}</p>}</section>}
    {isFinance && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><BadgeDollarSign size={18}/>Record a patient payment</h2><form onSubmit={receivePayment} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Approved patient bill<select className="form-input mt-1" value={payment.bill} onChange={(event) => setPayment({ ...payment, bill: event.target.value })} required><option value="">Select bill</option>{payable.map((bill) => <option key={bill._id} value={bill._id}>{bill.billNumber} Â· Patient {bill.patient?.patientNumber} Â· {currency(bill.totalAmount - bill.amountPaid)}</option>)}</select></label><div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Balance due<strong className="mt-1 block text-lg text-slate-900">{currency(balance)}</strong></div><label className="text-sm font-medium text-slate-700">Amount received<input className="form-input mt-1" type="number" min="0.01" max={balance} step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} required/></label><label className="text-sm font-medium text-slate-700">Deposit account{isCashPayment ? " (automatic for cash)" : ""}<select className="form-input mt-1" disabled={isCashPayment} required={!isCashPayment} value={payment.account} onChange={(event) => setPayment({ ...payment, account: event.target.value })}><option value="">Select account</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} Â· {account.accountName}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Payment method<select className="form-input mt-1" value={payment.paymentMethod} onChange={(event) => setPayment({ ...payment, paymentMethod: event.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label className="text-sm font-medium text-slate-700">Payment reference<input className="form-input mt-1" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} required/></label><div className="flex items-end justify-end md:col-span-2"><button disabled={saving || !selectedBill} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Recordingâ€¦" : "Record payment and post receipt"}</button></div></form></section>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 font-semibold text-slate-900">Patient bills and approval history</div>{loading ? <div className="p-6 text-sm text-slate-500">Loading billsâ€¦</div> : bills.length === 0 ? <div className="p-6 text-sm text-slate-500">No bills in this view.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["Bill", "Patient number", "Visit", "Charges", "Amount", "Paid", "Balance", "Status"].map((heading) => <th key={heading} className="p-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{bills.map((bill) => <tr key={bill._id} className="border-t"><td className="p-3 font-semibold">{bill.billNumber}</td><td className="p-3">{bill.patient?.patientNumber}</td><td className="p-3">{bill.visit?.visitType} Â· {bill.visit?.visitDate && new Date(bill.visit.visitDate).toLocaleDateString()}</td><td className="p-3">{bill.items?.map((item) => item.description).join(", ")}</td><td className="p-3">{currency(bill.totalAmount)}</td><td className="p-3">{currency(bill.amountPaid)}</td><td className="p-3">{currency(bill.totalAmount - bill.amountPaid)}</td><td className="p-3 capitalize">{bill.status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>}</section>
  </div>;
};

export default MedicalBillingPage;
