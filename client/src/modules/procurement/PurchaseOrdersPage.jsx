import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ClipboardList,
  Minus,
} from "lucide-react";

import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "../../services/purchaseOrder.service";

import { getSuppliers } from "../../services/supplier.service";

const emptyItem = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
};

const initialForm = {
  poNumber: "",
  supplier: "",
  items: [{ ...emptyItem }],
  tax: 0,
  status: "draft",
};

const PurchaseOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(initialForm);

  const loadData = async () => {
    try {
      setLoading(true);

      const [ordersResponse, suppliersResponse] =
        await Promise.all([
          getPurchaseOrders(),
          getSuppliers(),
        ]);

      setOrders(ordersResponse.data || []);
      setSuppliers(suppliersResponse.data || []);
    } catch (error) {
      console.error(
        "Failed to load purchase orders:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to load procurement data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateItemTotal = (item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return quantity * unitPrice;
  };

  const subtotal = useMemo(() => {
    return form.items.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0
    );
  }, [form.items]);

  const taxAmount = Number(form.tax) || 0;

  const totalAmount = subtotal + taxAmount;

  const handleBasicChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setForm((previous) => {
      const items = [...previous.items];

      const updatedItem = {
        ...items[index],
        [field]: value,
      };

      updatedItem.total = calculateItemTotal(
        updatedItem
      );

      items[index] = updatedItem;

      return {
        ...previous,
        items,
      };
    });
  };

  const addItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        { ...emptyItem },
      ],
    }));
  };

  const removeItem = (index) => {
    if (form.items.length === 1) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      items: previous.items.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const openCreateForm = () => {
    setEditingId(null);

    setForm({
      ...initialForm,
      items: [{ ...emptyItem }],
    });

    setShowForm(true);
  };

  const openEditForm = (order) => {
    setEditingId(order._id);

    setForm({
      poNumber: order.poNumber || "",
      supplier:
        typeof order.supplier === "object"
          ? order.supplier?._id
          : order.supplier || "",
      items:
        order.items?.length > 0
          ? order.items.map((item) => ({
              description: item.description || "",
              quantity: item.quantity || 0,
              unitPrice: item.unitPrice || 0,
              total:
                item.total ??
                calculateItemTotal(item),
            }))
          : [{ ...emptyItem }],
      tax: order.tax || 0,
      status: order.status || "draft",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);

    setForm({
      ...initialForm,
      items: [{ ...emptyItem }],
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.poNumber) {
      alert("Purchase order number is required.");
      return;
    }

    if (!form.supplier) {
      alert("Please select a supplier.");
      return;
    }

    const validItems = form.items.filter(
      (item) =>
        item.description.trim() &&
        Number(item.quantity) > 0
    );

    if (validItems.length === 0) {
      alert(
        "Please add at least one valid purchase order item."
      );
      return;
    }

    const preparedItems = validItems.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice) || 0,
      total: calculateItemTotal(item),
    }));

    const payload = {
      poNumber: form.poNumber.trim(),
      supplier: form.supplier,
      items: preparedItems,
      subtotal,
      tax: taxAmount,
      totalAmount,
      status: form.status,
    };

    try {
      setSaving(true);

      if (editingId) {
        await updatePurchaseOrder(
          editingId,
          payload
        );
      } else {
        await createPurchaseOrder(payload);
      }

      await loadData();

      closeForm();
    } catch (error) {
      console.error(
        "Failed to save purchase order:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save purchase order"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this purchase order?"
    );

    if (!confirmed) return;

    try {
      await deletePurchaseOrder(id);
      await loadData();
    } catch (error) {
      console.error(
        "Failed to delete purchase order:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete purchase order"
      );
    }
  };

  const filteredOrders = orders.filter((order) => {
    const query = search.toLowerCase();

    const supplierName =
      typeof order.supplier === "object"
        ? order.supplier?.name || ""
        : "";

    return (
      order.poNumber?.toLowerCase().includes(query) ||
      supplierName.toLowerCase().includes(query) ||
      order.status?.toLowerCase().includes(query)
    );
  });

  const getStatusClasses = (status) => {
    const classes = {
      draft: "bg-slate-100 text-slate-700",
      submitted: "bg-blue-100 text-blue-700",
      approved: "bg-emerald-100 text-emerald-700",
      ordered: "bg-primary-100 text-primary-700",
      received: "bg-purple-100 text-purple-700",
      cancelled: "bg-red-100 text-red-700",
    };

    return (
      classes[status] ||
      "bg-slate-100 text-slate-700"
    );
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
            <ClipboardList size={22} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Purchase Orders
            </h1>

            <p className="text-sm text-slate-500">
              Manage procurement purchase orders.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={18} />
          Create Purchase Order
        </button>
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
            placeholder="Search purchase orders..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading purchase orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList
              size={40}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-medium text-slate-700">
              No purchase orders found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Create your first purchase order.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    PO Number
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Supplier
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Items
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Total
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
                {filteredOrders.map((order) => (
                  <tr
                    key={order._id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {order.poNumber}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {typeof order.supplier ===
                      "object"
                        ? order.supplier?.name || "—"
                        : "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {order.items?.length || 0}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatAmount(
                        order.totalAmount
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(order)
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-700"
                          title="Edit purchase order"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(order._id)
                          }
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete purchase order"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchase Order Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? "Edit Purchase Order"
                    : "Create Purchase Order"}
                </h2>

                <p className="text-sm text-slate-500">
                  Enter purchase order details and items.
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

            <form
              onSubmit={handleSubmit}
              className="space-y-6 p-6"
            >
              {/* Basic details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    PO Number *
                  </label>

                  <input
                    name="poNumber"
                    value={form.poNumber}
                    onChange={handleBasicChange}
                    className="form-input"
                    placeholder="PO-2026-001"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Supplier *
                  </label>

                  <select
                    name="supplier"
                    value={form.supplier}
                    onChange={handleBasicChange}
                    className="form-input"
                    required
                  >
                    <option value="">
                      Select supplier
                    </option>

                    {suppliers
                      .filter(
                        (supplier) =>
                          supplier.status === "active"
                      )
                      .map((supplier) => (
                        <option
                          key={supplier._id}
                          value={supplier._id}
                        >
                          {supplier.supplierCode} —{" "}
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Order Items
                    </h3>

                    <p className="text-xs text-slate-500">
                      Add products or services being
                      procured.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    <Plus size={15} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-12">
                        <div className="md:col-span-5">
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            Description
                          </label>

                          <input
                            value={item.description}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                "description",
                                event.target.value
                              )
                            }
                            className="form-input"
                            placeholder="Item description"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            Quantity
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                "quantity",
                                event.target.value
                              )
                            }
                            className="form-input"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            Unit Price
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                "unitPrice",
                                event.target.value
                              )
                            }
                            className="form-input"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            Total
                          </label>

                          <div className="flex h-[42px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
                            {formatAmount(
                              calculateItemTotal(
                                item
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex items-end justify-end md:col-span-1">
                          <button
                            type="button"
                            onClick={() =>
                              removeItem(index)
                            }
                            disabled={
                              form.items.length === 1
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Remove item"
                          >
                            <Minus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="ml-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    Subtotal
                  </span>

                  <span className="font-medium text-slate-900">
                    {formatAmount(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-2 text-sm">
                  <label
                    htmlFor="tax"
                    className="text-slate-600"
                  >
                    Tax
                  </label>

                  <input
                    id="tax"
                    name="tax"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tax}
                    onChange={handleBasicChange}
                    className="form-input w-40 text-right"
                  />
                </div>

                <div className="mt-2 flex justify-between border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-900">
                    Total Amount
                  </span>

                  <span className="font-bold text-primary-700">
                    {formatAmount(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="max-w-md">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleBasicChange}
                  className="form-input"
                >
                  <option value="draft">Draft</option>
                  <option value="submitted">
                    Submitted
                  </option>
                  <option value="approved">
                    Approved
                  </option>
                  <option value="ordered">
                    Ordered
                  </option>
                  <option value="received">
                    Received
                  </option>
                  <option value="cancelled">
                    Cancelled
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
                    ? "Update Purchase Order"
                    : "Create Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;