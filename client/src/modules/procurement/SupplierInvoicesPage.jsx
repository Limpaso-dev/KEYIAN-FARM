import { useEffect, useMemo, useState } from "react";
import { FileCheck2, Plus, X } from "lucide-react";
import { getPurchaseOrders } from "../../services/purchaseOrder.service";
import { getGoodsReceipts, getSupplierInvoices, submitSupplierInvoice } from "../../services/supplyChain.service";

const money = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(amount) || 0);

const SupplierInvoicesPage = () => {
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [lines, setLines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [poData, receiptData, invoiceData] = await Promise.all([getPurchaseOrders(), getGoodsReceipts(), getSupplierInvoices()]);
      setOrders((poData.data || []).filter((item) => ["approved", "ordered", "partially_received", "received"].includes(item.status)));
      setReceipts(receiptData.data || []); setInvoices(invoiceData.data || []);
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not load supplier invoices"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const order = orders.find((item) => item._id === orderId);
  const receiptsForOrder = receipts.filter((item) => (item.purchaseOrder?._id || item.purchaseOrder) === orderId);
  const total = useMemo(() => lines.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0), [lines]);
  const selectOrder = (id) => {
    const selected = orders.find((item) => item._id === id);
    setOrderId(id); setReceiptId("");
    setLines((selected?.items || []).map((item) => ({ quantity: "0", unitPrice: String(item.unitPrice) })));
  };
  const selectReceipt = (id) => {
    setReceiptId(id);
    const selected = receipts.find((receipt) => receipt._id === id);
    const acceptedByIndex = new Map((selected?.items || []).map((item) => [item.poItemIndex, Number(item.acceptedQuantity || 0)]));
    setLines((order?.items || []).map((item, index) => ({ quantity: String(acceptedByIndex.get(index) || 0), unitPrice: String(item.unitPrice) })));
  };
  const changeLine = (index, field, value) => setLines((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await submitSupplierInvoice({ invoiceNumber, supportingDocumentUrl: documentUrl, purchaseOrder: orderId, goodsReceipt: receiptId, items: lines.map((item) => ({ quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })) });
      setShowForm(false); setInvoiceNumber(""); setDocumentUrl(""); setOrderId(""); setReceiptId(""); setLines([]); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not submit supplier invoice"); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><FileCheck2 size={22}/></div><div><h2 className="text-xl font-bold text-slate-900">Supplier invoices</h2><p className="text-sm text-slate-500">Tie invoices to approved POs and goods receipts for Finance’s 3-way match.</p></div></div><button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/>Submit invoice</button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{loading ? <div className="p-6 text-sm text-slate-500">Loading invoices…</div> : invoices.length === 0 ? <div className="p-6 text-sm text-slate-500">No supplier invoices submitted.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["Invoice", "Supplier", "PO / GRN", "Amount", "Match", "Status"].map((heading) => <th className="p-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead><tbody>{invoices.map((invoice) => <tr className="border-t" key={invoice._id}><td className="p-3 font-semibold">{invoice.invoiceNumber}</td><td className="p-3">{invoice.supplier?.name}</td><td className="p-3">{invoice.purchaseOrder?.poNumber}<div className="text-xs text-slate-500">{invoice.goodsReceipt?.receiptNumber}</div></td><td className="p-3">{money(invoice.totalAmount)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${invoice.matchStatus === "matched" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{invoice.matchStatus}</span>{invoice.discrepancies?.map((item) => <p key={item} className="mt-1 max-w-sm text-xs text-rose-700">{item}</p>)}</td><td className="p-3 capitalize">{invoice.status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>}</div>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl"><div className="flex items-center justify-between border-b p-5"><div><h3 className="font-bold text-slate-900">Submit supplier invoice</h3><p className="text-sm text-slate-500">Finance checks quantities and rates against the approved PO and accepted GRN.</p></div><button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div><form onSubmit={submit} className="space-y-4 p-5"><label className="block text-sm font-medium text-slate-700">Purchase order<select className="form-input mt-1" value={orderId} onChange={(event) => selectOrder(event.target.value)} required><option value="">Select approved PO</option>{orders.map((item) => <option key={item._id} value={item._id}>{item.poNumber} · {item.supplier?.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Goods received note<select className="form-input mt-1" value={receiptId} onChange={(event) => selectReceipt(event.target.value)} required><option value="">Select GRN</option>{receiptsForOrder.map((item) => <option key={item._id} value={item._id}>{item.receiptNumber} · {new Date(item.receivedAt).toLocaleDateString()}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Supplier invoice number<input className="form-input mt-1" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} required/></label>{order && <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Line</th><th className="p-2">Qty invoiced</th><th className="p-2">Invoice rate (KES)</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-t"><td className="p-2">{item.description}</td><td className="p-2"><input className="form-input w-24" type="number" min="0" step="any" value={lines[index]?.quantity ?? 0} onChange={(event) => changeLine(index, "quantity", event.target.value)}/></td><td className="p-2"><input className="form-input w-32" type="number" min="0" step="0.01" value={lines[index]?.unitPrice ?? item.unitPrice} onChange={(event) => changeLine(index, "unitPrice", event.target.value)}/></td></tr>)}</tbody></table><p className="mt-2 text-right font-semibold">Invoice total: {money(total)}</p></div>}<div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving || !receiptId} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Submitting…" : "Send to Finance"}</button></div></form></div></div>}
  </div>;
};

export default SupplierInvoicesPage;
