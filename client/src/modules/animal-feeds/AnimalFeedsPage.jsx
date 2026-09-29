import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wheat,
  X,
} from "lucide-react";

import {
  createAnimalFeed,
  deleteAnimalFeed,
  getAnimalFeeds,
  updateAnimalFeed,
} from "../../services/animalFeed.service";
import { getSuppliers } from "../../services/supplier.service";

const initialForm = {
  name: "",
  feedType: "",
  unit: "",
  quantity: 0,
  reorderLevel: 0,
  unitCost: 0,
  supplier: "",
  status: "active",
};

const AnimalFeedsPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadFeeds = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getAnimalFeeds();
      setFeeds(response.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to load animal feed records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;

    Promise.all([getAnimalFeeds(), getSuppliers()])
      .then(([feedResponse, supplierResponse]) => {
        if (current) {
          setFeeds(feedResponse.data || []);
          setSuppliers(supplierResponse.data || []);
        }
      })
      .catch((requestError) => {
        if (current) {
          setError(
            requestError.response?.data?.message ||
              "Failed to load animal feeds and suppliers."
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditForm = (feed) => {
    setEditingId(feed._id);
    setForm({
      name: feed.name || "",
      feedType: feed.feedType || "",
      unit: feed.unit || "",
      quantity: feed.quantity ?? 0,
      reorderLevel: feed.reorderLevel ?? 0,
      unitCost: feed.unitCost ?? 0,
      supplier: feed.supplier?._id || feed.supplier || "",
      status: feed.status || "active",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.unit.trim()) {
      setError("Feed name and unit are required.");
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      feedType: form.feedType.trim(),
      unit: form.unit.trim(),
      quantity: Number(form.quantity),
      reorderLevel: Number(form.reorderLevel),
      unitCost: Number(form.unitCost),
      supplier: form.supplier || null,
    };

    try {
      setSaving(true);
      setError("");
      if (editingId) {
        await updateAnimalFeed(editingId, payload);
      } else {
        await createAnimalFeed(payload);
      }
      await loadFeeds();
      closeForm();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to save animal feed record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (feed) => {
    if (!window.confirm(`Delete ${feed.name}?`)) return;
    try {
      setError("");
      await deleteAnimalFeed(feed._id);
      await loadFeeds();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to delete animal feed record."
      );
    }
  };

  const query = search.trim().toLowerCase();
  const filteredFeeds = feeds.filter((feed) =>
    [feed.name, feed.feedType, feed.unit]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  );
  const lowStockFeeds = feeds.filter(
    (feed) =>
      feed.status === "active" &&
      Number(feed.quantity) <= Number(feed.reorderLevel)
  );
  const stockValue = feeds.reduce(
    (total, feed) =>
      total + Number(feed.quantity || 0) * Number(feed.unitCost || 0),
    0
  );
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(value || 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
            <Wheat size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Animal Feeds</h1>
            <p className="text-sm text-slate-500">Manage feed stock and reorder levels.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={18} /> Add Feed
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Summary icon={Package} label="Feed Items" value={feeds.length} />
        <Summary icon={AlertTriangle} label="At Reorder Level" value={lowStockFeeds.length} />
        <Summary icon={Wheat} label="Stock Value" value={formatCurrency(stockValue)} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-sm">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search feeds"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </label>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading animal feeds...</p>
        ) : filteredFeeds.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No animal feed records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Feed</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Reorder At</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Unit Cost</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFeeds.map((feed) => {
                  const lowStock =
                    feed.status === "active" &&
                    Number(feed.quantity) <= Number(feed.reorderLevel);
                  return (
                    <tr key={feed._id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{feed.name}</td>
                      <td className="px-4 py-3 text-slate-600">{feed.feedType || "-"}</td>
                      <td className={`px-4 py-3 ${lowStock ? "font-semibold text-amber-700" : "text-slate-600"}`}>
                        {feed.quantity} {feed.unit}
                        {lowStock && <span className="ml-2 text-xs">Low</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{feed.reorderLevel} {feed.unit}</td>
                      <td className="px-4 py-3 text-slate-600">{feed.supplier?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(feed.unitCost)}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{feed.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" title="Edit feed" onClick={() => openEditForm(feed)} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                            <Pencil size={16} />
                          </button>
                          <button type="button" title="Delete feed" onClick={() => handleDelete(feed)} className="rounded p-2 text-red-600 hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="feed-form-title">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="feed-form-title" className="text-lg font-semibold text-slate-900">{editingId ? "Edit Feed" : "Add Feed"}</h2>
              <button type="button" onClick={closeForm} aria-label="Close form" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Feed name" name="name" value={form.name} onChange={handleChange} required />
              <Field label="Feed type" name="feedType" value={form.feedType} onChange={handleChange} />
              <Field label="Unit" name="unit" value={form.unit} onChange={handleChange} required placeholder="e.g. kg, bag" />
              <Field label="Quantity" name="quantity" value={form.quantity} onChange={handleChange} type="number" min="0" step="any" required />
              <Field label="Reorder level" name="reorderLevel" value={form.reorderLevel} onChange={handleChange} type="number" min="0" step="any" required />
              <Field label="Unit cost (KES)" name="unitCost" value={form.unitCost} onChange={handleChange} type="number" min="0" step="any" required />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Supplier
                <select name="supplier" value={form.supplier} onChange={handleChange} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  <option value="">No supplier selected</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Status
                <select name="status" value={form.status} onChange={handleChange} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">{saving ? "Saving..." : editingId ? "Save Changes" : "Create Feed"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Summary = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600"><Icon size={19} /></div>
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  </div>
);

const Field = ({ label, ...props }) => (
  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
    {label}
    <input {...props} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
  </label>
);

export default AnimalFeedsPage;