import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  FileText,
  Wallet,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Search,
  Home,
  CalendarDays,
  CreditCard,
  AlertCircle,
} from "lucide-react";

import { getRentalSummary } from "../../services/rental.service";
import {
  getProperties,
  createProperty,
  updateProperty,
  deleteProperty,
} from "../../services/rentalProperty.service";
import {
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
} from "../../services/rentalTenant.service";
import {
  getLeases,
  createLease,
  updateLease,
  deleteLease,
} from "../../services/lease.service";
import {
  getRentPayments,
  createRentPayment,
  updateRentPayment,
  deleteRentPayment,
} from "../../services/rentPayment.service";

const emptyProperty = {
  name: "",
  location: "",
  propertyType: "residential",
  units: [],
};

const emptyTenant = {
  name: "",
  phone: "",
  email: "",
  property: "",
  unitNumber: "",
  leaseStart: "",
  leaseEnd: "",
  monthlyRent: "",
  status: "active",
};

const emptyLease = {
  tenant: "",
  property: "",
  unitNumber: "",
  leaseStart: "",
  leaseEnd: "",
  monthlyRent: "",
  securityDeposit: "",
  paymentDueDay: 5,
  status: "draft",
  notes: "",
};

const emptyPayment = {
  tenant: "",
  lease: "",
  property: "",
  unitNumber: "",
  amount: "",
  paymentDate: "",
  paymentMethod: "mpesa",
  reference: "",
  period: "",
  status: "confirmed",
  notes: "",
};

const formatCurrency = (value) => {
  return `KES ${Number(value || 0).toLocaleString()}`;
};

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getPropertyName = (property) => {
  if (!property) return "-";

  if (typeof property === "object") {
    return property.name || "-";
  }

  return property;
};

const getTenantName = (tenant) => {
  if (!tenant) return "-";

  if (typeof tenant === "object") {
    return tenant.name || "-";
  }

  return tenant;
};

const getLeaseStatusClass = (status) => {
  const classes = {
    draft: "bg-slate-100 text-slate-700",
    active: "bg-emerald-100 text-emerald-700",
    expired: "bg-red-100 text-red-700",
    terminated: "bg-orange-100 text-orange-700",
  };

  return classes[status] || "bg-slate-100 text-slate-700";
};

const getPaymentStatusClass = (status) => {
  const classes = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    reversed: "bg-red-100 text-red-700",
  };

  return classes[status] || "bg-slate-100 text-slate-700";
};

const getTenantStatusClass = (status) => {
  return status === "active"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-700";
};

const RentalsPage = () => {
  const [activeTab, setActiveTab] = useState("properties");

  const [summary, setSummary] = useState({
    properties: 0,
    activeTenants: 0,
    activeLeases: 0,
    totalRentCollected: 0,
  });

  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const [propertyForm, setPropertyForm] =
    useState(emptyProperty);

  const [tenantForm, setTenantForm] =
    useState(emptyTenant);

  const [leaseForm, setLeaseForm] =
    useState(emptyLease);

  const [paymentForm, setPaymentForm] =
    useState(emptyPayment);

  /*
  |--------------------------------------------------------------------------
  | DATA LOADING
  |--------------------------------------------------------------------------
  */

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        summaryResponse,
        propertiesResponse,
        tenantsResponse,
        leasesResponse,
        paymentsResponse,
      ] = await Promise.all([
        getRentalSummary(),
        getProperties(),
        getTenants(),
        getLeases(),
        getRentPayments(),
      ]);

      setSummary(
        summaryResponse?.data || {
          properties: 0,
          activeTenants: 0,
          activeLeases: 0,
          totalRentCollected: 0,
        }
      );

      setProperties(propertiesResponse?.data || []);
      setTenants(tenantsResponse?.data || []);
      setLeases(leasesResponse?.data || []);
      setPayments(paymentsResponse?.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load rental data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | HELPERS
  |--------------------------------------------------------------------------
  */

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const closeModal = () => {
    setModal(null);
    setEditingItem(null);

    setPropertyForm(emptyProperty);
    setTenantForm(emptyTenant);
    setLeaseForm(emptyLease);
    setPaymentForm(emptyPayment);

    clearMessages();
  };

  const openCreateModal = (type) => {
    clearMessages();
    setEditingItem(null);

    if (type === "property") {
      setPropertyForm(emptyProperty);
    }

    if (type === "tenant") {
      setTenantForm(emptyTenant);
    }

    if (type === "lease") {
      setLeaseForm(emptyLease);
    }

    if (type === "payment") {
      setPaymentForm({
        ...emptyPayment,
        paymentDate: new Date()
          .toISOString()
          .split("T")[0],
      });
    }

    setModal(type);
  };

  const openEditModal = (type, item) => {
    clearMessages();
    setEditingItem(item);

    if (type === "property") {
      setPropertyForm({
        name: item.name || "",
        location: item.location || "",
        propertyType:
          item.propertyType || "residential",
        units: item.units || [],
      });
    }

    if (type === "tenant") {
      setTenantForm({
        name: item.name || "",
        phone: item.phone || "",
        email: item.email || "",
        property:
          typeof item.property === "object"
            ? item.property?._id
            : item.property || "",
        unitNumber: item.unitNumber || "",
        leaseStart: item.leaseStart
          ? item.leaseStart.split("T")[0]
          : "",
        leaseEnd: item.leaseEnd
          ? item.leaseEnd.split("T")[0]
          : "",
        monthlyRent: item.monthlyRent ?? "",
        status: item.status || "active",
      });
    }

    if (type === "lease") {
      setLeaseForm({
        tenant:
          typeof item.tenant === "object"
            ? item.tenant?._id
            : item.tenant || "",
        property:
          typeof item.property === "object"
            ? item.property?._id
            : item.property || "",
        unitNumber: item.unitNumber || "",
        leaseStart: item.leaseStart
          ? item.leaseStart.split("T")[0]
          : "",
        leaseEnd: item.leaseEnd
          ? item.leaseEnd.split("T")[0]
          : "",
        monthlyRent: item.monthlyRent ?? "",
        securityDeposit: item.securityDeposit ?? "",
        paymentDueDay: item.paymentDueDay ?? 5,
        status: item.status || "draft",
        notes: item.notes || "",
      });
    }

    if (type === "payment") {
      setPaymentForm({
        tenant:
          typeof item.tenant === "object"
            ? item.tenant?._id
            : item.tenant || "",
        lease:
          typeof item.lease === "object"
            ? item.lease?._id
            : item.lease || "",
        property:
          typeof item.property === "object"
            ? item.property?._id
            : item.property || "",
        unitNumber: item.unitNumber || "",
        amount: item.amount ?? "",
        paymentDate: item.paymentDate
          ? item.paymentDate.split("T")[0]
          : "",
        paymentMethod:
          item.paymentMethod || "mpesa",
        reference: item.reference || "",
        period: item.period || "",
        status: item.status || "confirmed",
        notes: item.notes || "",
      });
    }

    setModal(type);
  };

  /*
  |--------------------------------------------------------------------------
  | PROPERTY HANDLERS
  |--------------------------------------------------------------------------
  */

  const handlePropertySubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      if (editingItem) {
        await updateProperty(
          editingItem._id,
          propertyForm
        );
        setSuccess("Property updated successfully.");
      } else {
        await createProperty(propertyForm);
        setSuccess("Property created successfully.");
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save property."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProperty = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this property?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deleteProperty(id);

      setSuccess("Property deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete property."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | TENANT HANDLERS
  |--------------------------------------------------------------------------
  */

  const handleTenantSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      const payload = {
        ...tenantForm,
        monthlyRent:
          tenantForm.monthlyRent === ""
            ? undefined
            : Number(tenantForm.monthlyRent),
      };

      if (editingItem) {
        await updateTenant(editingItem._id, payload);
        setSuccess("Tenant updated successfully.");
      } else {
        await createTenant(payload);
        setSuccess("Tenant created successfully.");
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save tenant."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTenant = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this tenant?"
    );

    if (!confirmed) return;

    try {
      clearMessages();

      await deleteTenant(id);

      setSuccess("Tenant deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete tenant."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LEASE HANDLERS
  |--------------------------------------------------------------------------
  */

  const handleLeaseSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      const payload = {
        ...leaseForm,
        monthlyRent: Number(leaseForm.monthlyRent),
        securityDeposit:
          Number(leaseForm.securityDeposit) || 0,
        paymentDueDay: Number(leaseForm.paymentDueDay),
      };

      if (editingItem) {
        await updateLease(editingItem._id, payload);
        setSuccess("Lease updated successfully.");
      } else {
        await createLease(payload);
        setSuccess("Lease created successfully.");
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save lease."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLease = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this lease?"
    );

    if (!confirmed) return;

    try {
      clearMessages();

      await deleteLease(id);

      setSuccess("Lease deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete lease."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | PAYMENT HANDLERS
  |--------------------------------------------------------------------------
  */

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      const payload = {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      };

      if (editingItem) {
        await updateRentPayment(
          editingItem._id,
          payload
        );
        setSuccess(
          "Rent payment updated successfully."
        );
      } else {
        await createRentPayment(payload);
        setSuccess(
          "Rent payment recorded successfully."
        );
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save rent payment."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this rent payment?"
    );

    if (!confirmed) return;

    try {
      clearMessages();

      await deleteRentPayment(id);

      setSuccess(
        "Rent payment deleted successfully."
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete rent payment."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SEARCH / FILTER
  |--------------------------------------------------------------------------
  */

  const filteredProperties = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return properties;

    return properties.filter((property) =>
      [
        property.name,
        property.location,
        property.propertyType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [properties, search]);

  const filteredTenants = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return tenants;

    return tenants.filter((tenant) =>
      [
        tenant.name,
        tenant.phone,
        tenant.email,
        tenant.unitNumber,
        getPropertyName(tenant.property),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [tenants, search]);

  const filteredLeases = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return leases;

    return leases.filter((lease) =>
      [
        getTenantName(lease.tenant),
        getPropertyName(lease.property),
        lease.unitNumber,
        lease.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [leases, search]);

  const filteredPayments = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return payments;

    return payments.filter((payment) =>
      [
        getTenantName(payment.tenant),
        getPropertyName(payment.property),
        payment.unitNumber,
        payment.reference,
        payment.period,
        payment.paymentMethod,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [payments, search]);

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  const tabs = [
    {
      id: "properties",
      label: "Properties",
      icon: Building2,
    },
    {
      id: "tenants",
      label: "Tenants",
      icon: Users,
    },
    {
      id: "leases",
      label: "Leases",
      icon: FileText,
    },
    {
      id: "payments",
      label: "Rent Payments",
      icon: Wallet,
    },
  ];

  const modalTitle = {
    property: editingItem
      ? "Edit Property"
      : "Add Property",
    tenant: editingItem
      ? "Edit Tenant"
      : "Add Tenant",
    lease: editingItem
      ? "Edit Lease"
      : "Create Lease",
    payment: editingItem
      ? "Edit Rent Payment"
      : "Record Rent Payment",
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">
            Property & Rental Management
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Rentals
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage properties, tenants, leases and rent
            payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "properties") {
                openCreateModal("property");
              }

              if (activeTab === "tenants") {
                openCreateModal("tenant");
              }

              if (activeTab === "leases") {
                openCreateModal("lease");
              }

              if (activeTab === "payments") {
                openCreateModal("payment");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus size={17} />
            Add{" "}
            {activeTab === "properties"
              ? "Property"
              : activeTab === "tenants"
              ? "Tenant"
              : activeTab === "leases"
              ? "Lease"
              : "Payment"}
          </button>
        </div>
      </div>

      {/* ALERTS */}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Properties"
          value={summary.properties}
          icon={Building2}
        />

        <SummaryCard
          title="Active Tenants"
          value={summary.activeTenants}
          icon={Users}
        />

        <SummaryCard
          title="Active Leases"
          value={summary.activeLeases}
          icon={FileText}
        />

        <SummaryCard
          title="Rent Collected"
          value={formatCurrency(
            summary.totalRentCollected
          )}
          icon={Wallet}
        />
      </div>

      {/* TABS */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearch("");
                    clearMessages();
                  }}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "border-primary-500 text-primary-700"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TOOLBAR */}

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={`Search ${activeTab}...`}
              className="form-input pl-10"
            />
          </div>

          <p className="text-sm text-slate-500">
            {activeTab === "properties" &&
              `${filteredProperties.length} properties`}
            {activeTab === "tenants" &&
              `${filteredTenants.length} tenants`}
            {activeTab === "leases" &&
              `${filteredLeases.length} leases`}
            {activeTab === "payments" &&
              `${filteredPayments.length} payments`}
          </p>
        </div>

        {/* CONTENT */}

        <div className="overflow-x-auto">
          {activeTab === "properties" && (
            <PropertiesTable
              properties={filteredProperties}
              onEdit={(item) =>
                openEditModal("property", item)
              }
              onDelete={handleDeleteProperty}
            />
          )}

          {activeTab === "tenants" && (
            <TenantsTable
              tenants={filteredTenants}
              onEdit={(item) =>
                openEditModal("tenant", item)
              }
              onDelete={handleDeleteTenant}
            />
          )}

          {activeTab === "leases" && (
            <LeasesTable
              leases={filteredLeases}
              onEdit={(item) =>
                openEditModal("lease", item)
              }
              onDelete={handleDeleteLease}
            />
          )}

          {activeTab === "payments" && (
            <PaymentsTable
              payments={filteredPayments}
              onEdit={(item) =>
                openEditModal("payment", item)
              }
              onDelete={handleDeletePayment}
            />
          )}
        </div>
      </div>

      {/* MODALS */}

      {modal === "property" && (
        <Modal
          title={modalTitle.property}
          onClose={closeModal}
        >
          <form
            onSubmit={handlePropertySubmit}
            className="space-y-5"
          >
            <div>
              <label className="form-label">
                Property Name
              </label>

              <input
                required
                value={propertyForm.name}
                onChange={(event) =>
                  setPropertyForm({
                    ...propertyForm,
                    name: event.target.value,
                  })
                }
                className="form-input"
                placeholder="e.g. Keiyian Commercial Centre"
              />
            </div>

            <div>
              <label className="form-label">
                Location
              </label>

              <input
                value={propertyForm.location}
                onChange={(event) =>
                  setPropertyForm({
                    ...propertyForm,
                    location: event.target.value,
                  })
                }
                className="form-input"
                placeholder="Property location"
              />
            </div>

            <div>
              <label className="form-label">
                Property Type
              </label>

              <select
                value={propertyForm.propertyType}
                onChange={(event) =>
                  setPropertyForm({
                    ...propertyForm,
                    propertyType: event.target.value,
                  })
                }
                className="form-input"
              >
                <option value="residential">
                  Residential
                </option>
                <option value="commercial">
                  Commercial
                </option>
                <option value="office">
                  Office
                </option>
                <option value="other">
                  Other
                </option>
              </select>
            </div>

            <FormActions
              onCancel={closeModal}
              saving={saving}
              label={
                editingItem
                  ? "Update Property"
                  : "Create Property"
              }
            />
          </form>
        </Modal>
      )}

      {modal === "tenant" && (
        <Modal
          title={modalTitle.tenant}
          onClose={closeModal}
        >
          <form
            onSubmit={handleTenantSubmit}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Tenant Name"
                required
                value={tenantForm.name}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    name: value,
                  })
                }
              />

              <FormField
                label="Phone"
                value={tenantForm.phone}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    phone: value,
                  })
                }
              />

              <FormField
                label="Email"
                type="email"
                value={tenantForm.email}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    email: value,
                  })
                }
              />

              <div>
                <label className="form-label">
                  Property
                </label>

                <select
                  value={tenantForm.property}
                  onChange={(event) =>
                    setTenantForm({
                      ...tenantForm,
                      property: event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="">
                    Select property
                  </option>

                  {properties.map((property) => (
                    <option
                      key={property._id}
                      value={property._id}
                    >
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>

              <FormField
                label="Unit Number"
                value={tenantForm.unitNumber}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    unitNumber: value,
                  })
                }
              />

              <FormField
                label="Monthly Rent"
                type="number"
                value={tenantForm.monthlyRent}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    monthlyRent: value,
                  })
                }
              />

              <FormField
                label="Lease Start"
                type="date"
                value={tenantForm.leaseStart}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    leaseStart: value,
                  })
                }
              />

              <FormField
                label="Lease End"
                type="date"
                value={tenantForm.leaseEnd}
                onChange={(value) =>
                  setTenantForm({
                    ...tenantForm,
                    leaseEnd: value,
                  })
                }
              />

              <div>
                <label className="form-label">
                  Status
                </label>

                <select
                  value={tenantForm.status}
                  onChange={(event) =>
                    setTenantForm({
                      ...tenantForm,
                      status: event.target.value,
                    })
                  }
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
            </div>

            <FormActions
              onCancel={closeModal}
              saving={saving}
              label={
                editingItem
                  ? "Update Tenant"
                  : "Create Tenant"
              }
            />
          </form>
        </Modal>
      )}

      {modal === "lease" && (
        <Modal
          title={modalTitle.lease}
          onClose={closeModal}
        >
          <form
            onSubmit={handleLeaseSubmit}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">
                  Tenant
                </label>

                <select
                  required
                  value={leaseForm.tenant}
                  onChange={(event) =>
                    setLeaseForm({
                      ...leaseForm,
                      tenant: event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="">
                    Select tenant
                  </option>

                  {tenants.map((tenant) => (
                    <option
                      key={tenant._id}
                      value={tenant._id}
                    >
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  Property
                </label>

                <select
                  required
                  value={leaseForm.property}
                  onChange={(event) =>
                    setLeaseForm({
                      ...leaseForm,
                      property: event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="">
                    Select property
                  </option>

                  {properties.map((property) => (
                    <option
                      key={property._id}
                      value={property._id}
                    >
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>

              <FormField
                label="Unit Number"
                required
                value={leaseForm.unitNumber}
                onChange={(value) =>
                  setLeaseForm({
                    ...leaseForm,
                    unitNumber: value,
                  })
                }
              />

              <FormField
                label="Monthly Rent"
                type="number"
                required
                value={leaseForm.monthlyRent}
                onChange={(value) =>
                  setLeaseForm({
                    ...leaseForm,
                    monthlyRent: value,
                  })
                }
              />

              <FormField
                label="Lease Start"
                type="date"
                required
                value={leaseForm.leaseStart}
                onChange={(value) =>
                  setLeaseForm({
                    ...leaseForm,
                    leaseStart: value,
                  })
                }
              />

              <FormField
                label="Lease End"
                type="date"
                required
                value={leaseForm.leaseEnd}
                onChange={(value) =>
                  setLeaseForm({
                    ...leaseForm,
                    leaseEnd: value,
                  })
                }
              />

              <FormField
                label="Security Deposit"
                type="number"
                value={leaseForm.securityDeposit}
                onChange={(value) =>
                  setLeaseForm({
                    ...leaseForm,
                    securityDeposit: value,
                  })
                }
              />

              <FormField
                label="Payment Due Day"
                type="number"
                min="1"
                max="31"
                value={leaseForm.paymentDueDay}
                onChange={(value) =>
                  setLeaseForm({
                    ...leaseForm,
                    paymentDueDay: value,
                  })
                }
              />

              <div>
                <label className="form-label">
                  Status
                </label>

                <select
                  value={leaseForm.status}
                  onChange={(event) =>
                    setLeaseForm({
                      ...leaseForm,
                      status: event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="draft">
                    Draft
                  </option>
                  <option value="active">
                    Active
                  </option>
                  <option value="expired">
                    Expired
                  </option>
                  <option value="terminated">
                    Terminated
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="form-label">
                  Notes
                </label>

                <textarea
                  value={leaseForm.notes}
                  onChange={(event) =>
                    setLeaseForm({
                      ...leaseForm,
                      notes: event.target.value,
                    })
                  }
                  rows={3}
                  className="form-input"
                  placeholder="Additional lease notes..."
                />
              </div>
            </div>

            <FormActions
              onCancel={closeModal}
              saving={saving}
              label={
                editingItem
                  ? "Update Lease"
                  : "Create Lease"
              }
            />
          </form>
        </Modal>
      )}

      {modal === "payment" && (
        <Modal
          title={modalTitle.payment}
          onClose={closeModal}
        >
          <form
            onSubmit={handlePaymentSubmit}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">
                  Tenant
                </label>

                <select
                  required
                  value={paymentForm.tenant}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      tenant: event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="">
                    Select tenant
                  </option>

                  {tenants.map((tenant) => (
                    <option
                      key={tenant._id}
                      value={tenant._id}
                    >
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  Lease
                </label>

                <select
                  required
                  value={paymentForm.lease}
                  onChange={(event) => {
                    const leaseId =
                      event.target.value;

                    const selectedLease =
                      leases.find(
                        (lease) =>
                          lease._id === leaseId
                      );

                    setPaymentForm({
                      ...paymentForm,
                      lease: leaseId,
                      property:
                        selectedLease &&
                        typeof selectedLease.property ===
                          "object"
                          ? selectedLease.property._id
                          : selectedLease?.property ||
                            "",
                      unitNumber:
                        selectedLease?.unitNumber || "",
                    });
                  }}
                  className="form-input"
                >
                  <option value="">
                    Select lease
                  </option>

                  {leases.map((lease) => (
                    <option
                      key={lease._id}
                      value={lease._id}
                    >
                      {getTenantName(lease.tenant)} -{" "}
                      {lease.unitNumber}
                    </option>
                  ))}
                </select>
              </div>

              <FormField
                label="Unit Number"
                required
                value={paymentForm.unitNumber}
                onChange={(value) =>
                  setPaymentForm({
                    ...paymentForm,
                    unitNumber: value,
                  })
                }
              />

              <FormField
                label="Amount"
                type="number"
                required
                value={paymentForm.amount}
                onChange={(value) =>
                  setPaymentForm({
                    ...paymentForm,
                    amount: value,
                  })
                }
              />

              <FormField
                label="Payment Date"
                type="date"
                required
                value={paymentForm.paymentDate}
                onChange={(value) =>
                  setPaymentForm({
                    ...paymentForm,
                    paymentDate: value,
                  })
                }
              />

              <div>
                <label className="form-label">
                  Payment Method
                </label>

                <select
                  required
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMethod:
                        event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="mpesa">
                    M-Pesa
                  </option>
                  <option value="bank">
                    Bank
                  </option>
                  <option value="cash">
                    Cash
                  </option>
                  <option value="cheque">
                    Cheque
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <FormField
                label="Reference"
                required
                value={paymentForm.reference}
                onChange={(value) =>
                  setPaymentForm({
                    ...paymentForm,
                    reference: value,
                  })
                }
                placeholder="e.g. MPESA123456"
              />

              <FormField
                label="Period"
                required
                value={paymentForm.period}
                onChange={(value) =>
                  setPaymentForm({
                    ...paymentForm,
                    period: value,
                  })
                }
                placeholder="e.g. September 2026"
              />

              <div>
                <label className="form-label">
                  Status
                </label>

                <select
                  value={paymentForm.status}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      status: event.target.value,
                    })
                  }
                  className="form-input"
                >
                  <option value="pending">
                    Pending
                  </option>
                  <option value="confirmed">
                    Confirmed
                  </option>
                  <option value="reversed">
                    Reversed
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="form-label">
                  Notes
                </label>

                <textarea
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      notes: event.target.value,
                    })
                  }
                  rows={3}
                  className="form-input"
                  placeholder="Additional payment notes..."
                />
              </div>
            </div>

            <FormActions
              onCancel={closeModal}
              saving={saving}
              label={
                editingItem
                  ? "Update Payment"
                  : "Record Payment"
              }
            />
          </form>
        </Modal>
      )}
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| SUMMARY CARD
|--------------------------------------------------------------------------
*/

const SummaryCard = ({
  title,
  value,
  icon: Icon,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| TABLES
|--------------------------------------------------------------------------
*/

const PropertiesTable = ({
  properties,
  onEdit,
  onDelete,
}) => {
  if (!properties.length) {
    return <EmptyState label="properties" />;
  }

  return (
    <table className="w-full min-w-[800px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-5 py-3">Property</th>
          <th className="px-5 py-3">Location</th>
          <th className="px-5 py-3">Type</th>
          <th className="px-5 py-3">Units</th>
          <th className="px-5 py-3 text-right">
            Actions
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {properties.map((property) => (
          <tr
            key={property._id}
            className="hover:bg-slate-50"
          >
            <td className="px-5 py-4 font-medium text-slate-900">
              {property.name}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {property.location || "-"}
            </td>

            <td className="px-5 py-4 capitalize text-slate-600">
              {property.propertyType || "-"}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {property.units?.length || 0}
            </td>

            <TableActions
              onEdit={() => onEdit(property)}
              onDelete={() =>
                onDelete(property._id)
              }
            />
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TenantsTable = ({
  tenants,
  onEdit,
  onDelete,
}) => {
  if (!tenants.length) {
    return <EmptyState label="tenants" />;
  }

  return (
    <table className="w-full min-w-[1000px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-5 py-3">Tenant</th>
          <th className="px-5 py-3">Phone</th>
          <th className="px-5 py-3">Property</th>
          <th className="px-5 py-3">Unit</th>
          <th className="px-5 py-3">Monthly Rent</th>
          <th className="px-5 py-3">Status</th>
          <th className="px-5 py-3 text-right">
            Actions
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {tenants.map((tenant) => (
          <tr
            key={tenant._id}
            className="hover:bg-slate-50"
          >
            <td className="px-5 py-4">
              <p className="font-medium text-slate-900">
                {tenant.name}
              </p>

              {tenant.email && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {tenant.email}
                </p>
              )}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {tenant.phone || "-"}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {getPropertyName(tenant.property)}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {tenant.unitNumber || "-"}
            </td>

            <td className="px-5 py-4 font-medium text-slate-700">
              {formatCurrency(tenant.monthlyRent)}
            </td>

            <td className="px-5 py-4">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTenantStatusClass(
                  tenant.status
                )}`}
              >
                {tenant.status}
              </span>
            </td>

            <TableActions
              onEdit={() => onEdit(tenant)}
              onDelete={() => onDelete(tenant._id)}
            />
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const LeasesTable = ({
  leases,
  onEdit,
  onDelete,
}) => {
  if (!leases.length) {
    return <EmptyState label="leases" />;
  }

  return (
    <table className="w-full min-w-[1000px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-5 py-3">Tenant</th>
          <th className="px-5 py-3">Property</th>
          <th className="px-5 py-3">Unit</th>
          <th className="px-5 py-3">Period</th>
          <th className="px-5 py-3">Rent</th>
          <th className="px-5 py-3">Status</th>
          <th className="px-5 py-3 text-right">
            Actions
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {leases.map((lease) => (
          <tr
            key={lease._id}
            className="hover:bg-slate-50"
          >
            <td className="px-5 py-4 font-medium text-slate-900">
              {getTenantName(lease.tenant)}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {getPropertyName(lease.property)}
            </td>

            <td className="px-5 py-4 text-slate-600">
              {lease.unitNumber}
            </td>

            <td className="px-5 py-4 text-slate-600">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} />
                {formatDate(lease.leaseStart)}
                <span>–</span>
                {formatDate(lease.leaseEnd)}
              </div>
            </td>

            <td className="px-5 py-4 font-medium text-slate-700">
              {formatCurrency(lease.monthlyRent)}
            </td>

            <td className="px-5 py-4">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getLeaseStatusClass(
                  lease.status
                )}`}
              >
                {lease.status}
              </span>
            </td>

            <TableActions
              onEdit={() => onEdit(lease)}
              onDelete={() => onDelete(lease._id)}
            />
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const PaymentsTable = ({
  payments,
  onEdit,
  onDelete,
}) => {
  if (!payments.length) {
    return <EmptyState label="rent payments" />;
  }

  return (
    <table className="w-full min-w-[1100px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-5 py-3">Tenant</th>
          <th className="px-5 py-3">Property / Unit</th>
          <th className="px-5 py-3">Period</th>
          <th className="px-5 py-3">Amount</th>
          <th className="px-5 py-3">Method</th>
          <th className="px-5 py-3">Reference</th>
          <th className="px-5 py-3">Status</th>
          <th className="px-5 py-3 text-right">
            Actions
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {payments.map((payment) => (
          <tr
            key={payment._id}
            className="hover:bg-slate-50"
          >
            <td className="px-5 py-4 font-medium text-slate-900">
              {getTenantName(payment.tenant)}
            </td>

            <td className="px-5 py-4 text-slate-600">
              <p>
                {getPropertyName(payment.property)}
              </p>

              <p className="text-xs text-slate-400">
                Unit {payment.unitNumber}
              </p>
            </td>

            <td className="px-5 py-4 text-slate-600">
              <p>{payment.period}</p>
              <p className="text-xs text-slate-400">
                {formatDate(payment.paymentDate)}
              </p>
            </td>

            <td className="px-5 py-4 font-semibold text-slate-900">
              {formatCurrency(payment.amount)}
            </td>

            <td className="px-5 py-4 capitalize text-slate-600">
              {payment.paymentMethod}
            </td>

            <td className="px-5 py-4 font-mono text-xs text-slate-600">
              {payment.reference}
            </td>

            <td className="px-5 py-4">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getPaymentStatusClass(
                  payment.status
                )}`}
              >
                {payment.status}
              </span>
            </td>

            <TableActions
              onEdit={() => onEdit(payment)}
              onDelete={() => onDelete(payment._id)}
            />
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/*
|--------------------------------------------------------------------------
| TABLE ACTIONS
|--------------------------------------------------------------------------
*/

const TableActions = ({
  onEdit,
  onDelete,
}) => {
  return (
    <td className="px-5 py-4">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
          title="Edit"
        >
          <Pencil size={16} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </td>
  );
};

/*
|--------------------------------------------------------------------------
| MODAL
|--------------------------------------------------------------------------
*/

const Modal = ({
  title,
  onClose,
  children,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| FORM FIELD
|--------------------------------------------------------------------------
*/

const FormField = ({
  label,
  required = false,
  type = "text",
  value,
  onChange,
  placeholder,
  min,
  max,
}) => {
  return (
    <div>
      <label className="form-label">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        type={type}
        required={required}
        value={value}
        min={min}
        max={max}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="form-input"
      />
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| FORM ACTIONS
|--------------------------------------------------------------------------
*/

const FormActions = ({
  onCancel,
  saving,
  label,
}) => {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : label}
      </button>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| EMPTY STATE
|--------------------------------------------------------------------------
*/

const EmptyState = ({ label }) => {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4 text-slate-400">
        <Home size={24} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        No {label} found
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Records will appear here once they are added.
      </p>
    </div>
  );
};

export default RentalsPage;