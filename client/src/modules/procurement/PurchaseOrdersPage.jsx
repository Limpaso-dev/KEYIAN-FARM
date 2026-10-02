import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ClipboardList, Plus, Search, X } from "lucide-react";
import { getPurchaseOrders, createPurchaseOrder, placePurchaseOrder } from "../../services/purchaseOrder.service";
import { getSuppliers } from "../../services/supplier.service";
import { getPurchaseRequests } from "../../services/workflow.service";

const currency = (value) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 2 }).format(Number(value) || 0);

const PurchaseOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState("");
  const [supplier, setSupplier] = useState("");
  const [quotationUrl, setQuotationUrl] = useState("");
  const [unitPrices, setUnitPrices] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placingId, setPlacingId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [poResponse, supplierResponse, requestResponse] = await Promise.all([getPurchaseOrders(), getSuppliers(), getPurchaseRequests()]);
      const poRows = poResponse.data || [];
      setOrders(poRows);
      setSuppliers((supplierResponse.data || []).filter((item) => item.status === "active"));
      const alreadyConverted = new Set(poRows.map((order) => order.purchaseRequest?._id || order.purchaseRequest).filter(Boolean));
      setRequests((requestResponse.data || []).filter((request) => request.status === "approved" && !alreadyConverted.has(request._id)));
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to load purchase workflow data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const request = requests.find((item) => item._id === selectedRequest);
  const total = useMemo(() => (request?.items || []).reduce((sum, item, index) => sum + Number(item.quantity) * Number(unitPrices[index] ?? item.unitPrice), 0), [request, unitPrices]);
  const filtered = orders.filter((order) => `${order.poNumber} ${order.supplier?.name || ""} ${order.status}`.toLowerCase().includes(search.trim().toLowerCase()));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await createPurchaseOrder({ purchaseRequest: selectedRequest, supplier, unitPrices, quotationUrl });
      setShowForm(false); setSelectedRequest(""); setSupplier(""); setUnitPrices([]); setQuotationUrl("");
      await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to submit purchase order"); }
    finally { setSaving(false); }
  };

  const placeWithSupplier = async (order) => {
    setPlacingId(order._id); setError("");
    try { await placePurchaseOrder(order._id); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Could not place the order"); }
    finally { setPlacingId(""); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary-100 p-3 text-primary-700"><ClipboardList size={22}/></div><div><h2 className="text-xl font-bold text-slate-900">Purchase Orders</h2><p className="text-sm text-slate-500">Convert approved requests into supplier orders and route each PO for approval.</p></div></div><button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/>Create from approved request</button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="relative max-w-md"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="form-input pl-10" placeholder="Search purchase orders..." value={search} onChange={(event) => setSearch(event.target.value)}/></div></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{loading ? <div className="p-8 text-center text-sm text-slate-500">Loading purchase orders…</div> : filtered.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No purchase orders yet. Fully approved requests will be available to convert here.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["PO / Request", "Department", "Supplier", "Lines", "Total", "Status", "Next step"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((order) => <tr key={order._id}><td className="px-4 py-3 font-semibold text-slate-900">{order.poNumber}<div className="text-xs font-normal text-slate-500">{order.purchaseRequest?.requestNumber || ""}</div></td><td className="px-4 py-3 text-slate-600">{order.department}</td><td className="px-4 py-3">{order.supplier?.name || "—"}</td><td className="px-4 py-3">{order.items?.length || 0}</td><td className="px-4 py-3 font-semibold">{currency(order.totalAmount)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{order.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3">{order.status === "approved" ? <button disabled={placingId === order._id} onClick={() => placeWithSupplier(order)} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{placingId === order._id ? "Saving…" : "Mark supplier order sent"}</button> : "—"}</td></tr>)}</tbody></table></div>}</div>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h3 className="font-bold text-slate-900">Create PO from approved request</h3><p className="text-sm text-slate-500">Request details carry forward; the new PO follows a separate approval policy.</p></div><button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div><form onSubmit={submit} className="space-y-5 p-5"><label className="block text-sm font-medium text-slate-700">Approved purchase request<select className="form-input mt-1" value={selectedRequest} onChange={(event) => { const value = event.target.value; const selected = requests.find((item) => item._id === value); setSelectedRequest(value); setUnitPrices((selected?.items || []).map((item) => item.unitPrice)); }} required><option value="">Select a request</option>{requests.map((item) => <option key={item._id} value={item._id}>{item.requestNumber} · {item.department} · {currency(item.totalAmount)}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Supplier<select className="form-input mt-1" value={supplier} onChange={(event) => setSupplier(event.target.value)} required><option value="">Select supplier</option>{suppliers.map((item) => <option key={item._id} value={item._id}>{item.supplierCode} · {item.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Quotation / supporting document URL (optional)<input className="form-input mt-1" type="url" value={quotationUrl} onChange={(event) => setQuotationUrl(event.target.value)} placeholder="https://…"/></label>{request && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-3">Item</th><th className="p-3">Quantity</th><th className="p-3">Quoted unit price (KES)</th></tr></thead><tbody>{request.items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-t"><td className="p-3">{item.description}</td><td className="p-3">{item.quantity}</td><td className="p-3"><input className="form-input w-36" type="number" min="0" step="0.01" value={unitPrices[index] ?? item.unitPrice} onChange={(event) => setUnitPrices((prices) => prices.map((price, priceIndex) => priceIndex === index ? event.target.value : price))}/></td></tr>)}</tbody></table><div className="border-t bg-slate-50 p-3 text-right font-semibold">PO total: {currency(total)}</div></div>}<div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving || !request} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Submitting…" : "Submit PO for approval"}</button></div></form></div></div>}
  </div>;
};

export default PurchaseOrdersPage;
