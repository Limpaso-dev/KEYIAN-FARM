import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getInventory } from "../../services/inventory.service";
import { getGoodsReceipts, getPurchaseOrdersForReceiving, receivePurchaseOrder, releaseGoodsReceipt } from "../../services/supplyChain.service";

const GoodsReceivingPage = () => {
  const { user } = useAuth();
  const canVerify = ["procurement", "admin", "super_admin"].includes(user?.role);
  const canRelease = ["stores", "admin", "super_admin"].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [releaseLines, setReleaseLines] = useState({});
  const [releasingId, setReleasingId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [poData, stockData, receiptData] = await Promise.all([getPurchaseOrdersForReceiving(), getInventory(), getGoodsReceipts()]);
      setOrders((poData.data || []).filter((order) => ["ordered", "partially_received"].includes(order.status)));
      setInventory((stockData.data || []).filter((item) => item.status === "active"));
      setReceipts(receiptData.data || []);
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not load receiving data"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const selectedOrder = orders.find((order) => order._id === orderId);
  const totalAccepted = useMemo(() => lines.reduce((sum, item) => sum + Number(item.acceptedQuantity || 0), 0), [lines]);
  const selectOrder = (id) => {
    const order = orders.find((item) => item._id === id);
    setOrderId(id);
    setLines((order?.items || []).map((item) => ({ receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, inventoryItem: "" })));
  };
  const updateLine = (index, key, value) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedOrder) return;
    setSaving(true); setError("");
    try {
      await receivePurchaseOrder(orderId, { notes, items: lines.map((line) => ({ ...line, receivedQuantity: Number(line.receivedQuantity), acceptedQuantity: Number(line.acceptedQuantity), damagedQuantity: Number(line.damagedQuantity || 0) })) });
      setOrderId(""); setLines([]); setNotes(""); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not record goods receipt"); }
    finally { setSaving(false); }
  };
  const release = async (receipt) => {
    setReleasingId(receipt._id); setError("");
    try {
      const selected = receipt.items.map((_, index) => releaseLines[receipt._id]?.[index] || "");
      await releaseGoodsReceipt(receipt._id, { items: selected.map((inventoryItem) => ({ inventoryItem })) });
      await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Could not release goods to inventory"); }
    finally { setReleasingId(""); }
  };

  return <div className="space-y-6">
    <Link to="/inventory" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700"><ArrowLeft size={16}/>Inventory</Link>
    <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><PackageCheck size={22}/></div><div><h1 className="text-2xl font-bold text-slate-900">Goods receiving</h1><p className="text-sm text-slate-500">Record delivered, accepted, and damaged quantities against an approved PO.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {canVerify && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Procurement delivery check</h2><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Purchase order<select className="form-input mt-1" value={orderId} onChange={(event) => selectOrder(event.target.value)} required><option value="">Select purchase order</option>{orders.map((order) => <option key={order._id} value={order._id}>{order.poNumber} · {order.supplier?.name || "Supplier"} · {order.status}</option>)}</select></label>{selectedOrder && <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-3">PO item</th><th className="p-3">Ordered</th><th className="p-3">Received</th><th className="p-3">Accepted</th><th className="p-3">Damaged</th></tr></thead><tbody>{selectedOrder.items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-t"><td className="p-3 font-medium">{item.description}</td><td className="p-3">{item.quantity}</td>{["receivedQuantity", "acceptedQuantity", "damagedQuantity"].map((key) => <td key={key} className="p-3"><input className="form-input w-24" type="number" min="0" step="any" value={lines[index]?.[key] ?? 0} onChange={(event) => updateLine(index, key, event.target.value)}/></td>)}</tr>)}</tbody></table></div>}<label className="block text-sm text-slate-600">Receiving notes<textarea className="form-input mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery condition or discrepancy notes"/></label><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-sm text-slate-600">Accepted quantity for stores: <strong>{totalAccepted}</strong></span><button disabled={saving || !selectedOrder} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck size={16}/>{saving ? "Recording…" : "Verify delivery and send to stores"}</button></div></form></section>}
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4"><h2 className="font-semibold text-slate-900">Receipt history and store release</h2><p className="text-sm text-slate-500">Procurement verifies deliveries here. Stores select inventory items and release accepted quantities into stock.</p></div>{loading ? <div className="p-6 text-sm text-slate-500">Loading receipts…</div> : receipts.length === 0 ? <div className="p-6 text-sm text-slate-500">No goods receipts recorded.</div> : <div className="divide-y">{receipts.map((receipt) => <div key={receipt._id} className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-800">{receipt.receiptNumber} · {receipt.purchaseOrder?.poNumber}</p><p className="text-sm text-slate-500">{receipt.supplier?.name} · verified by {receipt.receivedBy?.name || "—"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{receipt.status?.replaceAll("_", " ") || "pending store"}</span></div>{canRelease && receipt.status !== "released_to_stores" && receipt.items?.map((item, index) => <div key={`${item.description}-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-3 md:items-center"><span className="text-sm">{item.description}: <strong>{item.acceptedQuantity}</strong> accepted</span>{item.acceptedQuantity > 0 && <select className="form-input" value={releaseLines[receipt._id]?.[index] || ""} onChange={(event) => setReleaseLines((current) => ({ ...current, [receipt._id]: { ...(current[receipt._id] || {}), [index]: event.target.value } }))}><option value="">Select stock item</option>{inventory.map((stock) => <option key={stock._id} value={stock._id}>{stock.itemCode} · {stock.name}</option>)}</select>}</div>)}{canRelease && receipt.status !== "released_to_stores" && <button disabled={releasingId === receipt._id} onClick={() => release(receipt)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{releasingId === receipt._id ? "Releasing…" : "Release accepted goods to inventory"}</button>}</div>)}</div>}</section>
  </div>;
};

export default GoodsReceivingPage;
