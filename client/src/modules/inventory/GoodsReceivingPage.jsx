import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getInventory } from "../../services/inventory.service";
import { getGoodsReceipts, getPurchaseOrdersForReceiving, receivePurchaseOrder } from "../../services/supplyChain.service";

const GoodsReceivingPage = () => {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  return <div className="space-y-6">
    <Link to="/inventory" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700"><ArrowLeft size={16}/>Inventory</Link>
    <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><PackageCheck size={22}/></div><div><h1 className="text-2xl font-bold text-slate-900">Goods receiving</h1><p className="text-sm text-slate-500">Record delivered, accepted, and damaged quantities against an approved PO.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Record a Goods Received Note</h2><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Approved purchase order<select className="form-input mt-1" value={orderId} onChange={(event) => selectOrder(event.target.value)} required><option value="">Select purchase order</option>{orders.map((order) => <option key={order._id} value={order._id}>{order.poNumber} · {order.supplier?.name || "Supplier"} · {order.status}</option>)}</select></label>{selectedOrder && <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-3">PO item</th><th className="p-3">Ordered</th><th className="p-3">Received</th><th className="p-3">Accepted</th><th className="p-3">Damaged</th><th className="p-3">Add accepted stock to</th></tr></thead><tbody>{selectedOrder.items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-t"><td className="p-3 font-medium">{item.description}</td><td className="p-3">{item.quantity}</td>{["receivedQuantity", "acceptedQuantity", "damagedQuantity"].map((key) => <td key={key} className="p-3"><input className="form-input w-24" type="number" min="0" step="any" value={lines[index]?.[key] ?? 0} onChange={(event) => updateLine(index, key, event.target.value)}/></td>)}<td className="p-3"><select className="form-input min-w-48" value={lines[index]?.inventoryItem || ""} onChange={(event) => updateLine(index, "inventoryItem", event.target.value)}><option value="">Select stock item</option>{inventory.map((stock) => <option key={stock._id} value={stock._id}>{stock.itemCode} · {stock.name}</option>)}</select></td></tr>)}</tbody></table></div>}<label className="block text-sm text-slate-600">Receiving notes<textarea className="form-input mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery condition or discrepancy notes"/></label><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-sm text-slate-600">Accepted quantity to add to inventory: <strong>{totalAccepted}</strong></span><button disabled={saving || !selectedOrder} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck size={16}/>{saving ? "Recording…" : "Record GRN and update inventory"}</button></div></form></section>
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-4"><h2 className="font-semibold text-slate-900">Receipt history</h2></div>{loading ? <div className="p-6 text-sm text-slate-500">Loading receipts…</div> : receipts.length === 0 ? <div className="p-6 text-sm text-slate-500">No goods receipts recorded.</div> : <div className="divide-y">{receipts.map((receipt) => <div key={receipt._id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-slate-800">{receipt.receiptNumber} · {receipt.purchaseOrder?.poNumber}</p><p className="text-sm text-slate-500">{receipt.supplier?.name} · received by {receipt.receivedBy?.name || "—"}</p></div><div className="text-right text-sm text-slate-600">{receipt.items?.reduce((sum, item) => sum + item.acceptedQuantity, 0)} accepted units<br/>{new Date(receipt.receivedAt).toLocaleDateString()}</div></div>)}</div>}</section>
  </div>;
};

export default GoodsReceivingPage;
