import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Send } from "lucide-react";
import { getAccounts } from "../../services/account.service";
import { getFinanceSupplierInvoices, getSupplierPayments, requestSupplierPayment } from "../../services/supplyChain.service";

const currency = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(amount) || 0);

const SupplierPaymentsPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ invoice: "", amount: "", account: "", paymentMethod: "bank_transfer", reference: "", paymentDate: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [invoiceData, paymentData, accountData] = await Promise.all([getFinanceSupplierInvoices(), getSupplierPayments(), getAccounts()]);
      setInvoices(invoiceData.data || []); setPayments(paymentData.data || []); setAccounts((accountData.data || []).filter((item) => item.status === "active" && item.accountType === "asset"));
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not load supplier payables"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const selectedInvoice = invoices.find((invoice) => invoice._id === form.invoice);
  const alreadyPaid = useMemo(() => payments.filter((payment) => payment.status === "approved" && (payment.invoice?._id || payment.invoice) === form.invoice).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [payments, form.invoice]);
  const remaining = selectedInvoice ? Math.max(0, selectedInvoice.totalAmount - alreadyPaid) : 0;

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await requestSupplierPayment({ ...form, amount: Number(form.amount) });
      setForm((current) => ({ ...current, invoice: "", amount: "", reference: "" })); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not send the payment for approval"); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><BadgeDollarSign size={22}/></div><div><h2 className="text-xl font-bold text-slate-900">Supplier payments</h2><p className="text-sm text-slate-500">Request approval for a payment. The finance transaction posts only after approval.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Approved supplier invoice<select className="form-input mt-1" value={form.invoice} onChange={(event) => setForm({ ...form, invoice: event.target.value })} required><option value="">Select payable invoice</option>{invoices.filter((invoice) => ["approved", "partially_paid"].includes(invoice.status)).map((invoice) => <option key={invoice._id} value={invoice._id}>{invoice.invoiceNumber} · {invoice.supplier?.name} · {currency(invoice.totalAmount)}</option>)}</select></label><div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Remaining payable<strong className="mt-1 block text-lg text-slate-900">{currency(remaining)}</strong></div><label className="text-sm font-medium text-slate-700">Payment amount (KES)<input className="form-input mt-1" type="number" min="0.01" max={remaining} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required/></label><label className="text-sm font-medium text-slate-700">Pay from account<select className="form-input mt-1" value={form.account} onChange={(event) => setForm({ ...form, account: event.target.value })} required><option value="">Select account</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} · {account.accountName}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Payment method<select className="form-input mt-1" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="mobile_money">Mobile money</option><option value="other">Other</option></select></label><label className="text-sm font-medium text-slate-700">Payment reference<input className="form-input mt-1" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} required/></label><label className="text-sm font-medium text-slate-700">Payment date<input className="form-input mt-1" type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} required/></label><div className="flex items-end justify-end"><button disabled={saving || !selectedInvoice} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Send size={16}/>{saving ? "Submitting…" : "Request payment approval"}</button></div></form></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 font-semibold text-slate-900">Payment audit</div>{loading ? <div className="p-6 text-sm text-slate-500">Loading payment records…</div> : payments.length === 0 ? <div className="p-6 text-sm text-slate-500">No supplier payments yet.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["Payment", "Invoice", "Supplier", "Amount", "Method / Reference", "Requested by", "Status"].map((heading) => <th className="p-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead><tbody>{payments.map((payment) => <tr key={payment._id} className="border-t"><td className="p-3 font-semibold">{payment.paymentNumber}</td><td className="p-3">{payment.invoice?.invoiceNumber}</td><td className="p-3">{payment.supplier?.name}</td><td className="p-3">{currency(payment.amount)}</td><td className="p-3">{payment.paymentMethod}<div className="text-xs text-slate-500">{payment.reference}</div></td><td className="p-3">{payment.requestedBy?.name}</td><td className="p-3 capitalize">{payment.status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>}</section>
  </div>;
};

export default SupplierPaymentsPage;
