import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Package,
  AlertTriangle,
} from "lucide-react";

import {
  getInventory,
  createInventory,
  updateInventory,
  deleteInventory,
} from "../../services/inventory.service";

const initialForm = {
  itemCode: "",
  name: "",
  category: "",
  unit: "",
  quantity: 0,
  reorderLevel: 0,
  unitCost: 0,
  location: "",
  status: "active",
};

const InventoryPage = () => {
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadInventory = async () => {
    try {
      setLoading(true);

      const response = await getInventory();

      setItems(response.data || []);
    } catch (error) {
      console.error(
        "Failed to load inventory:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to load inventory"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item._id);

    setForm({
      itemCode: item.itemCode || "",
      name: item.name || "",
      category: item.category || "",
      unit: item.unit || "",
      quantity: item.quantity ?? 0,
      reorderLevel: item.reorderLevel ?? 0,
      unitCost: item.unitCost ?? 0,
      location: item.location || "",
      status: item.status || "active",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.itemCode || !form.name) {
      alert(
        "Item code and item name are required."
      );

      return;
    }

    const payload = {
      itemCode: form.itemCode.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      quantity: Number(form.quantity) || 0,
      reorderLevel:
        Number(form.reorderLevel) || 0,
      unitCost: Number(form.unitCost) || 0,
      location: form.location.trim(),
      status: form.status,
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateInventory(
          editingId,
          payload
        );
      } else {
        await createInventory(payload);
      }

      await loadInventory();

      closeForm();
    } catch (error) {
      console.error(
        "Failed to save inventory item:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save inventory item"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this inventory item?"
    );

    if (!confirmed) return;

    try {
      await deleteInventory(id);

      await loadInventory();
    } catch (error) {
      console.error(
        "Failed to delete inventory item:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete inventory item"
      );
    }
  };

  const filteredItems = items.filter((item) => {
    const query = search.toLowerCase();

    return (
      item.itemCode
        ?.toLowerCase()
        .includes(query) ||
      item.name
        ?.toLowerCase()
        .includes(query) ||
      item.category
        ?.toLowerCase()
        .includes(query) ||
      item.location
        ?.toLowerCase()
        .includes(query)
    );
  });

  const lowStockItems = items.filter(
    (item) =>
      item.status === "active" &&
      Number(item.quantity) <=
        Number(item.reorderLevel)
  );

  const totalStockValue = items.reduce(
    (total, item) =>
      total +
      Number(item.quantity || 0) *
        Number(item.unitCost || 0),
    0
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
            <Package size={22} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Inventory
            </h1>

            <p className="text-sm text-slate-500">
              Manage stock items, quantities and
              inventory locations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={18} />
          Add Inventory Item
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Inventory Items
            </p>

            <Package
              size={20}
              className="text-primary-600"
            />
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {items.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Low Stock
            </p>

            <AlertTriangle
              size={20}
              className="text-amber-500"
            />
          </div>

          <p className="mt-2 text-2xl font-bold text-amber-600">
            {lowStockItems.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Stock Value
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totalStockValue)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search inventory..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center">
            <Package
              size={40}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-medium text-slate-700">
              No inventory items found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Add your first inventory item.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Item Code
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Item
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Category
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Quantity
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Reorder Level
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Unit Cost
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Location
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isLowStock =
                    item.status === "active" &&
                    Number(item.quantity) <=
                      Number(item.reorderLevel);

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                        {item.itemCode}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {item.name}
                        </div>

                        {item.unit && (
                          <div className="text-xs text-slate-500">
                            Unit: {item.unit}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {item.category || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            isLowStock
                              ? "font-semibold text-amber-600"
                              : "text-slate-700"
                          }
                        >
                          {item.quantity}
                        </span>

                        {isLowStock && (
                          <span className="ml-2 text-xs text-amber-600">
                            Low
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {item.reorderLevel}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(item.unitCost)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {item.location || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(item)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-700"
                            title="Edit item"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(item._id)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete item"
                          >
                            <Trash2 size={17} />
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
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? "Edit Inventory Item"
                    : "Add Inventory Item"}
                </h2>

                <p className="text-sm text-slate-500">
                  Enter inventory item information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Item Code */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Item Code *
                  </label>

                  <input
                    name="itemCode"
                    value={form.itemCode}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="INV-001"
                    required
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Item Name *
                  </label>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Item name"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Category
                  </label>

                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. Office Supplies"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Unit
                  </label>

                  <input
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. kg, litres, pieces"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                {/* Reorder Level */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Reorder Level
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="reorderLevel"
                    value={form.reorderLevel}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                {/* Unit Cost */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Unit Cost
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="unitCost"
                    value={form.unitCost}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Location
                  </label>

                  <input
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. Main Store"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Item"
                    : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;