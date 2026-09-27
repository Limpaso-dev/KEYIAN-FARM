import { useEffect, useMemo, useState } from "react";

import {
  Plus,
  Search,
  RefreshCw,
  Trash2,
  X,
  ShoppingCart,
  Users,
  Package,
  CreditCard,
  FileText,
  DollarSign,
} from "lucide-react";

import {
  createProduct,
  getProducts,
  deleteProduct,
} from "../../services/salesProduct.service";

import {
  createCustomer,
  getCustomers,
  deleteCustomer,
} from "../../services/salesCustomer.service";

import {
  createSale,
  getSales,
  deleteSale,
  getSalesSummary,
} from "../../services/sales.service";

import {
  createSalePayment,
  getSalePayments,
  deleteSalePayment,
} from "../../services/salePayment.service";

const emptySaleItem = {
  product: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  tax: 0,
};

const SalesPage = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");

  const [showProductForm, setShowProductForm] =
    useState(false);

  const [showCustomerForm, setShowCustomerForm] =
    useState(false);

  const [showSaleForm, setShowSaleForm] =
    useState(false);

  const [showPaymentForm, setShowPaymentForm] =
    useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    sku: "",
    unit: "",
    sellingPrice: "",
    stockQuantity: "",
    status: "active",
  });

  const [customerForm, setCustomerForm] = useState({
    customerCode: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    taxNumber: "",
    customerType: "individual",
    creditLimit: "",
    status: "active",
  });

  const [saleForm, setSaleForm] = useState({
    invoiceNumber: "",
    customer: "",
    saleDate: "",
    discount: 0,
    tax: 0,
    amountPaid: 0,
    paymentMethod: "cash",
    status: "confirmed",
    notes: "",
    items: [{ ...emptySaleItem }],
  });

  const [paymentForm, setPaymentForm] = useState({
    sale: "",
    customer: "",
    amount: "",
    paymentDate: "",
    paymentMethod: "cash",
    reference: "",
    status: "confirmed",
    notes: "",
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });

    setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 4000);
  };

  /*
  |--------------------------------------------------------------------------
  | DATA LOADING
  |--------------------------------------------------------------------------
  */

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        productsResponse,
        customersResponse,
        salesResponse,
        paymentsResponse,
        summaryResponse,
      ] = await Promise.all([
        getProducts(),
        getCustomers(),
        getSales(),
        getSalePayments(),
        getSalesSummary(),
      ]);

      setProducts(
        productsResponse?.products ||
          productsResponse?.data ||
          []
      );

      setCustomers(
        customersResponse?.customers ||
          customersResponse?.data ||
          []
      );

      setSales(
        salesResponse?.sales ||
          salesResponse?.data ||
          []
      );

      setPayments(
        paymentsResponse?.payments ||
          paymentsResponse?.data ||
          []
      );

      setSummary(
        summaryResponse?.summary ||
          summaryResponse?.data ||
          summaryResponse ||
          null
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to load sales data."
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
  | PRODUCT FORM
  |--------------------------------------------------------------------------
  */

  const handleProductChange = (e) => {
    const { name, value } = e.target;

    setProductForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      await createProduct({
        ...productForm,
        sellingPrice: Number(
          productForm.sellingPrice || 0
        ),
        stockQuantity: Number(
          productForm.stockQuantity || 0
        ),
      });

      setProductForm({
        name: "",
        category: "",
        sku: "",
        unit: "",
        sellingPrice: "",
        stockQuantity: "",
        status: "active",
      });

      setShowProductForm(false);

      showMessage(
        "success",
        "Product created successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to create product."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | CUSTOMER FORM
  |--------------------------------------------------------------------------
  */

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;

    setCustomerForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      await createCustomer({
        ...customerForm,
        creditLimit: Number(
          customerForm.creditLimit || 0
        ),
      });

      setCustomerForm({
        customerCode: "",
        name: "",
        phone: "",
        email: "",
        address: "",
        taxNumber: "",
        customerType: "individual",
        creditLimit: "",
        status: "active",
      });

      setShowCustomerForm(false);

      showMessage(
        "success",
        "Customer created successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to create customer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SALE FORM
  |--------------------------------------------------------------------------
  */

  const handleSaleChange = (e) => {
    const { name, value } = e.target;

    setSaleForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaleItemChange = (
    index,
    field,
    value
  ) => {
    setSaleForm((prev) => {
      const items = [...prev.items];

      items[index] = {
        ...items[index],
        [field]: value,
      };

      if (field === "product") {
        const selectedProduct = products.find(
          (product) =>
            product._id === value
        );

        if (selectedProduct) {
          items[index].unitPrice =
            selectedProduct.sellingPrice || 0;
        }
      }

      return {
        ...prev,
        items,
      };
    });
  };

  const addSaleItem = () => {
    setSaleForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { ...emptySaleItem },
      ],
    }));
  };

  const removeSaleItem = (index) => {
    setSaleForm((prev) => ({
      ...prev,
      items: prev.items.filter(
        (_, itemIndex) =>
          itemIndex !== index
      ),
    }));
  };

  const saleSubtotal = useMemo(() => {
    return saleForm.items.reduce(
      (total, item) => {
        const quantity =
          Number(item.quantity) || 0;

        const unitPrice =
          Number(item.unitPrice) || 0;

        const discount =
          Number(item.discount) || 0;

        const itemTotal =
          quantity * unitPrice;

        return (
          total +
          Math.max(
            itemTotal - discount,
            0
          )
        );
      },
      0
    );
  }, [saleForm.items]);

  const saleTotal = useMemo(() => {
    const discount =
      Number(saleForm.discount) || 0;

    const tax =
      Number(saleForm.tax) || 0;

    return Math.max(
      saleSubtotal - discount + tax,
      0
    );
  }, [
    saleSubtotal,
    saleForm.discount,
    saleForm.tax,
  ]);

  const handleCreateSale = async (e) => {
    e.preventDefault();

    if (!saleForm.customer) {
      showMessage(
        "error",
        "Please select a customer."
      );
      return;
    }

    if (
      saleForm.items.length === 0 ||
      saleForm.items.some(
        (item) => !item.product
      )
    ) {
      showMessage(
        "error",
        "Please add at least one valid product."
      );
      return;
    }

    try {
      setSubmitting(true);

      const items = saleForm.items.map(
        (item) => {
          const quantity =
            Number(item.quantity) || 0;

          const unitPrice =
            Number(item.unitPrice) || 0;

          const discount =
            Number(item.discount) || 0;

          const tax =
            Number(item.tax) || 0;

          const total = Math.max(
            quantity * unitPrice -
              discount +
              tax,
            0
          );

          return {
            product: item.product,
            quantity,
            unitPrice,
            discount,
            tax,
            total,
          };
        }
      );

      await createSale({
        invoiceNumber:
          saleForm.invoiceNumber.trim(),

        customer: saleForm.customer,

        saleDate:
          saleForm.saleDate ||
          new Date().toISOString(),

        items,

        discount: Number(
          saleForm.discount || 0
        ),

        tax: Number(
          saleForm.tax || 0
        ),

        amountPaid: Number(
          saleForm.amountPaid || 0
        ),

        paymentMethod:
          saleForm.paymentMethod,

        status: saleForm.status,

        notes: saleForm.notes,
      });

      setSaleForm({
        invoiceNumber: "",
        customer: "",
        saleDate: "",
        discount: 0,
        tax: 0,
        amountPaid: 0,
        paymentMethod: "cash",
        status: "confirmed",
        notes: "",
        items: [{ ...emptySaleItem }],
      });

      setShowSaleForm(false);

      showMessage(
        "success",
        "Sale created successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to create sale."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | PAYMENT FORM
  |--------------------------------------------------------------------------
  */

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;

    setPaymentForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "sale") {
      const selectedSale = sales.find(
        (sale) => sale._id === value
      );

      if (selectedSale) {
        setPaymentForm((prev) => ({
          ...prev,
          sale: value,
          customer:
            selectedSale.customer?._id ||
            selectedSale.customer ||
            "",
        }));
      }
    }
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();

    if (
      !paymentForm.sale ||
      !paymentForm.customer
    ) {
      showMessage(
        "error",
        "Please select a sale."
      );
      return;
    }

    try {
      setSubmitting(true);

      await createSalePayment({
        ...paymentForm,
        amount: Number(
          paymentForm.amount || 0
        ),
        paymentDate:
          paymentForm.paymentDate ||
          new Date().toISOString(),
      });

      setPaymentForm({
        sale: "",
        customer: "",
        amount: "",
        paymentDate: "",
        paymentMethod: "cash",
        reference: "",
        status: "confirmed",
        notes: "",
      });

      setShowPaymentForm(false);

      showMessage(
        "success",
        "Payment recorded successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to record payment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE HANDLERS
  |--------------------------------------------------------------------------
  */

  const handleDeleteProduct = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this product?"
      )
    ) {
      return;
    }

    try {
      await deleteProduct(id);

      showMessage(
        "success",
        "Product deleted successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to delete product."
      );
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this customer?"
      )
    ) {
      return;
    }

    try {
      await deleteCustomer(id);

      showMessage(
        "success",
        "Customer deleted successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to delete customer."
      );
    }
  };

  const handleDeleteSale = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this sale?"
      )
    ) {
      return;
    }

    try {
      await deleteSale(id);

      showMessage(
        "success",
        "Sale deleted successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to delete sale."
      );
    }
  };

  const handleDeletePayment = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this payment?"
      )
    ) {
      return;
    }

    try {
      await deleteSalePayment(id);

      showMessage(
        "success",
        "Payment deleted successfully."
      );

      await loadData();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message ||
          "Failed to delete payment."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | FILTERING
  |--------------------------------------------------------------------------
  */

  const filteredProducts = products.filter(
    (product) =>
      `${product.name} ${product.sku || ""} ${
        product.category || ""
      }`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const filteredCustomers = customers.filter(
    (customer) =>
      `${customer.name} ${
        customer.customerCode || ""
      } ${customer.phone || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const filteredSales = sales.filter(
    (sale) =>
      `${sale.invoiceNumber || ""} ${
        sale.customer?.name || ""
      }`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  /*
  |--------------------------------------------------------------------------
  | HELPERS
  |--------------------------------------------------------------------------
  */

  const getCustomerName = (customer) => {
    if (!customer) return "Unknown";

    if (typeof customer === "object") {
      return customer.name || "Unknown";
    }

    const found = customers.find(
      (item) => item._id === customer
    );

    return found?.name || "Unknown";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(
      "en-KE",
      {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
      }
    ).format(Number(amount) || 0);
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString(
      "en-KE",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  const statusBadge = (status) => {
    const styles = {
      paid: "bg-emerald-50 text-emerald-700",
      confirmed:
        "bg-emerald-50 text-emerald-700",
      completed:
        "bg-emerald-50 text-emerald-700",
      partially_paid:
        "bg-amber-50 text-amber-700",
      unpaid:
        "bg-red-50 text-red-700",
      cancelled:
        "bg-red-50 text-red-700",
      draft:
        "bg-slate-100 text-slate-700",
      pending:
        "bg-amber-50 text-amber-700",
      reversed:
        "bg-red-50 text-red-700",
    };

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
          styles[status] ||
          "bg-slate-100 text-slate-700"
        }`}
      >
        {String(status || "unknown")
          .replaceAll("_", " ")
          .replace(
            /\b\w/g,
            (letter) => letter.toUpperCase()
          )}
      </span>
    );
  };

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw
            size={20}
            className="animate-spin"
          />
          Loading sales module...
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Sales
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage products, customers, sales,
            invoices and payments.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {/* ALERT */}

      {message.text && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Sales"
          value={
            summary?.totalSales ??
            sales.length
          }
          icon={ShoppingCart}
        />

        <SummaryCard
          title="Total Revenue"
          value={formatCurrency(
            summary?.totalRevenue ??
              sales.reduce(
                (total, sale) =>
                  total +
                  Number(
                    sale.totalAmount || 0
                  ),
                0
              )
          )}
          icon={DollarSign}
        />

        <SummaryCard
          title="Customers"
          value={customers.length}
          icon={Users}
        />

        <SummaryCard
          title="Products"
          value={products.length}
          icon={Package}
        />
      </div>

      {/* TABS */}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex min-w-max border-b border-slate-200">
          {[
            ["overview", "Overview"],
            ["sales", "Sales"],
            ["customers", "Customers"],
            ["products", "Products"],
            ["payments", "Payments"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setSearch("");
              }}
              className={`border-b-2 px-5 py-3 text-sm font-medium transition ${
                activeTab === key
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Recent Sales
                </h2>

                <p className="text-sm text-slate-500">
                  Latest transactions
                </p>
              </div>

              <FileText
                size={20}
                className="text-primary-600"
              />
            </div>

            {sales.length === 0 ? (
              <EmptyState text="No sales recorded yet." />
            ) : (
              <div className="space-y-3">
                {sales.slice(0, 5).map(
                  (sale) => (
                    <div
                      key={sale._id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {sale.invoiceNumber}
                        </p>

                        <p className="text-xs text-slate-500">
                          {getCustomerName(
                            sale.customer
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            sale.totalAmount
                          )}
                        </p>

                        {statusBadge(
                          sale.paymentStatus
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Recent Payments
                </h2>

                <p className="text-sm text-slate-500">
                  Latest customer payments
                </p>
              </div>

              <CreditCard
                size={20}
                className="text-primary-600"
              />
            </div>

            {payments.length === 0 ? (
              <EmptyState text="No payments recorded yet." />
            ) : (
              <div className="space-y-3">
                {payments
                  .slice(0, 5)
                  .map((payment) => (
                    <div
                      key={payment._id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {payment.reference}
                        </p>

                        <p className="text-xs text-slate-500">
                          {payment.paymentMethod}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            payment.amount
                          )}
                        </p>

                        {statusBadge(
                          payment.status
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SALES */}

      {activeTab === "sales" && (
        <div className="space-y-4">
          <SectionHeader
            title="Sales & Invoices"
            buttonText="New Sale"
            onClick={() =>
              setShowSaleForm(true)
            }
          />

          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search invoice or customer..."
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Invoice
                  </TableHeader>

                  <TableHeader>
                    Customer
                  </TableHeader>

                  <TableHeader>
                    Date
                  </TableHeader>

                  <TableHeader>
                    Total
                  </TableHeader>

                  <TableHeader>
                    Payment
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Actions
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filteredSales.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No sales found.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(
                    (sale) => (
                      <tr
                        key={sale._id}
                        className="border-t border-slate-100"
                      >
                        <TableCell strong>
                          {
                            sale.invoiceNumber
                          }
                        </TableCell>

                        <TableCell>
                          {getCustomerName(
                            sale.customer
                          )}
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            sale.saleDate
                          )}
                        </TableCell>

                        <TableCell strong>
                          {formatCurrency(
                            sale.totalAmount
                          )}
                        </TableCell>

                        <TableCell>
                          {statusBadge(
                            sale.paymentStatus
                          )}
                        </TableCell>

                        <TableCell>
                          {statusBadge(
                            sale.status
                          )}
                        </TableCell>

                        <TableCell>
                          <button
                            onClick={() =>
                              handleDeleteSale(
                                sale._id
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        </TableCell>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMERS */}

      {activeTab === "customers" && (
        <div className="space-y-4">
          <SectionHeader
            title="Customers"
            buttonText="Add Customer"
            onClick={() =>
              setShowCustomerForm(true)
            }
          />

          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search customers..."
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Code
                  </TableHeader>

                  <TableHeader>
                    Customer
                  </TableHeader>

                  <TableHeader>
                    Phone
                  </TableHeader>

                  <TableHeader>
                    Type
                  </TableHeader>

                  <TableHeader>
                    Credit Limit
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Actions
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(
                    (customer) => (
                      <tr
                        key={customer._id}
                        className="border-t border-slate-100"
                      >
                        <TableCell strong>
                          {
                            customer.customerCode
                          }
                        </TableCell>

                        <TableCell>
                          {customer.name}
                        </TableCell>

                        <TableCell>
                          {customer.phone ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {customer.customerType}
                        </TableCell>

                        <TableCell>
                          {formatCurrency(
                            customer.creditLimit
                          )}
                        </TableCell>

                        <TableCell>
                          {statusBadge(
                            customer.status
                          )}
                        </TableCell>

                        <TableCell>
                          <button
                            onClick={() =>
                              handleDeleteCustomer(
                                customer._id
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        </TableCell>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCTS */}

      {activeTab === "products" && (
        <div className="space-y-4">
          <SectionHeader
            title="Products"
            buttonText="Add Product"
            onClick={() =>
              setShowProductForm(true)
            }
          />

          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search products..."
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Product
                  </TableHeader>

                  <TableHeader>
                    SKU
                  </TableHeader>

                  <TableHeader>
                    Category
                  </TableHeader>

                  <TableHeader>
                    Unit
                  </TableHeader>

                  <TableHeader>
                    Selling Price
                  </TableHeader>

                  <TableHeader>
                    Stock
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Actions
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(
                    (product) => (
                      <tr
                        key={product._id}
                        className="border-t border-slate-100"
                      >
                        <TableCell strong>
                          {product.name}
                        </TableCell>

                        <TableCell>
                          {product.sku ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {product.category ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {product.unit ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {formatCurrency(
                            product.sellingPrice
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            product.stockQuantity
                          }
                        </TableCell>

                        <TableCell>
                          {statusBadge(
                            product.status
                          )}
                        </TableCell>

                        <TableCell>
                          <button
                            onClick={() =>
                              handleDeleteProduct(
                                product._id
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        </TableCell>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENTS */}

      {activeTab === "payments" && (
        <div className="space-y-4">
          <SectionHeader
            title="Sales Payments"
            buttonText="Record Payment"
            onClick={() =>
              setShowPaymentForm(true)
            }
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>
                    Reference
                  </TableHeader>

                  <TableHeader>
                    Sale
                  </TableHeader>

                  <TableHeader>
                    Customer
                  </TableHeader>

                  <TableHeader>
                    Date
                  </TableHeader>

                  <TableHeader>
                    Method
                  </TableHeader>

                  <TableHeader>
                    Amount
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Actions
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map(
                    (payment) => (
                      <tr
                        key={payment._id}
                        className="border-t border-slate-100"
                      >
                        <TableCell strong>
                          {
                            payment.reference
                          }
                        </TableCell>

                        <TableCell>
                          {payment.sale
                            ?.invoiceNumber ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {getCustomerName(
                            payment.customer
                          )}
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            payment.paymentDate
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            payment.paymentMethod
                          }
                        </TableCell>

                        <TableCell strong>
                          {formatCurrency(
                            payment.amount
                          )}
                        </TableCell>

                        <TableCell>
                          {statusBadge(
                            payment.status
                          )}
                        </TableCell>

                        <TableCell>
                          <button
                            onClick={() =>
                              handleDeletePayment(
                                payment._id
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        </TableCell>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================
          PRODUCT MODAL
      ===================================================== */}

      {showProductForm && (
        <Modal
          title="Add Product"
          onClose={() =>
            setShowProductForm(false)
          }
        >
          <form
            onSubmit={handleCreateProduct}
            className="space-y-4"
          >
            <FormField
              label="Product Name"
              name="name"
              value={productForm.name}
              onChange={handleProductChange}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Category"
                name="category"
                value={productForm.category}
                onChange={handleProductChange}
              />

              <FormField
                label="SKU"
                name="sku"
                value={productForm.sku}
                onChange={handleProductChange}
              />

              <FormField
                label="Unit"
                name="unit"
                value={productForm.unit}
                onChange={handleProductChange}
                placeholder="kg, litre, piece..."
              />

              <FormField
                label="Selling Price"
                name="sellingPrice"
                type="number"
                min="0"
                value={
                  productForm.sellingPrice
                }
                onChange={handleProductChange}
                required
              />

              <FormField
                label="Stock Quantity"
                name="stockQuantity"
                type="number"
                min="0"
                value={
                  productForm.stockQuantity
                }
                onChange={handleProductChange}
              />

              <SelectField
                label="Status"
                name="status"
                value={productForm.status}
                onChange={handleProductChange}
                options={[
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ]}
              />
            </div>

            <ModalActions
              onCancel={() =>
                setShowProductForm(false)
              }
              submitting={submitting}
            />
          </form>
        </Modal>
      )}

      {/* =====================================================
          CUSTOMER MODAL
      ===================================================== */}

      {showCustomerForm && (
        <Modal
          title="Add Customer"
          onClose={() =>
            setShowCustomerForm(false)
          }
        >
          <form
            onSubmit={handleCreateCustomer}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Customer Code"
                name="customerCode"
                value={
                  customerForm.customerCode
                }
                onChange={
                  handleCustomerChange
                }
                required
              />

              <FormField
                label="Customer Name"
                name="name"
                value={customerForm.name}
                onChange={
                  handleCustomerChange
                }
                required
              />

              <FormField
                label="Phone"
                name="phone"
                value={customerForm.phone}
                onChange={
                  handleCustomerChange
                }
              />

              <FormField
                label="Email"
                name="email"
                type="email"
                value={customerForm.email}
                onChange={
                  handleCustomerChange
                }
              />

              <FormField
                label="Tax Number"
                name="taxNumber"
                value={customerForm.taxNumber}
                onChange={
                  handleCustomerChange
                }
              />

              <SelectField
                label="Customer Type"
                name="customerType"
                value={
                  customerForm.customerType
                }
                onChange={
                  handleCustomerChange
                }
                options={[
                  [
                    "individual",
                    "Individual",
                  ],
                  [
                    "business",
                    "Business",
                  ],
                  [
                    "institution",
                    "Institution",
                  ],
                  ["other", "Other"],
                ]}
              />

              <FormField
                label="Credit Limit"
                name="creditLimit"
                type="number"
                min="0"
                value={
                  customerForm.creditLimit
                }
                onChange={
                  handleCustomerChange
                }
              />

              <div className="sm:col-span-2">
                <FormField
                  label="Address"
                  name="address"
                  value={
                    customerForm.address
                  }
                  onChange={
                    handleCustomerChange
                  }
                />
              </div>
            </div>

            <ModalActions
              onCancel={() =>
                setShowCustomerForm(false)
              }
              submitting={submitting}
            />
          </form>
        </Modal>
      )}

      {/* =====================================================
          SALE MODAL
      ===================================================== */}

      {showSaleForm && (
        <Modal
          title="Create Sale"
          wide
          onClose={() =>
            setShowSaleForm(false)
          }
        >
          <form
            onSubmit={handleCreateSale}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                label="Invoice Number"
                name="invoiceNumber"
                value={
                  saleForm.invoiceNumber
                }
                onChange={handleSaleChange}
                placeholder="INV-0001"
                required
              />

              <SelectField
                label="Customer"
                name="customer"
                value={saleForm.customer}
                onChange={handleSaleChange}
                options={[
                  ["", "Select customer"],
                  ...customers.map(
                    (customer) => [
                      customer._id,
                      `${customer.customerCode} - ${customer.name}`,
                    ]
                  ),
                ]}
                required
              />

              <FormField
                label="Sale Date"
                name="saleDate"
                type="date"
                value={saleForm.saleDate}
                onChange={handleSaleChange}
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">
                  Sale Items
                </h3>

                <button
                  type="button"
                  onClick={addSaleItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
                >
                  <Plus size={16} />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {saleForm.items.map(
                  (item, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div className="md:col-span-2">
                          <label className="form-label">
                            Product
                          </label>

                          <select
                            className="form-input"
                            value={
                              item.product
                            }
                            onChange={(e) =>
                              handleSaleItemChange(
                                index,
                                "product",
                                e.target.value
                              )
                            }
                            required
                          >
                            <option value="">
                              Select product
                            </option>

                            {products
                              .filter(
                                (product) =>
                                  product.status ===
                                  "active"
                              )
                              .map(
                                (product) => (
                                  <option
                                    key={
                                      product._id
                                    }
                                    value={
                                      product._id
                                    }
                                  >
                                    {product.name}
                                  </option>
                                )
                              )}
                          </select>
                        </div>

                        <FormField
                          label="Quantity"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={
                            item.quantity
                          }
                          onChange={(e) =>
                            handleSaleItemChange(
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                        />

                        <FormField
                          label="Unit Price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            item.unitPrice
                          }
                          onChange={(e) =>
                            handleSaleItemChange(
                              index,
                              "unitPrice",
                              e.target.value
                            )
                          }
                        />

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() =>
                              removeSaleItem(
                                index
                              )
                            }
                            disabled={
                              saleForm.items
                                .length ===
                              1
                            }
                            className="w-full rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 text-right text-sm font-semibold text-slate-700">
                        Item Total:{" "}
                        {formatCurrency(
                          Math.max(
                            (Number(
                              item.quantity
                            ) || 0) *
                              (Number(
                                item.unitPrice
                              ) || 0) -
                              (Number(
                                item.discount
                              ) || 0) +
                              (Number(
                                item.tax
                              ) || 0),
                            0
                          )
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <FormField
                label="Discount"
                name="discount"
                type="number"
                min="0"
                step="0.01"
                value={saleForm.discount}
                onChange={handleSaleChange}
              />

              <FormField
                label="Tax"
                name="tax"
                type="number"
                min="0"
                step="0.01"
                value={saleForm.tax}
                onChange={handleSaleChange}
              />

              <FormField
                label="Amount Paid"
                name="amountPaid"
                type="number"
                min="0"
                step="0.01"
                value={saleForm.amountPaid}
                onChange={handleSaleChange}
              />

              <SelectField
                label="Payment Method"
                name="paymentMethod"
                value={
                  saleForm.paymentMethod
                }
                onChange={handleSaleChange}
                options={[
                  ["cash", "Cash"],
                  ["mpesa", "M-Pesa"],
                  ["bank", "Bank"],
                  ["cheque", "Cheque"],
                  ["credit", "Credit"],
                  ["other", "Other"],
                ]}
              />
            </div>

            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <div className="flex items-center justify-between text-sm">
                <span>Subtotal</span>

                <span>
                  {formatCurrency(
                    saleSubtotal
                  )}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Discount</span>

                <span>
                  {formatCurrency(
                    saleForm.discount
                  )}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Tax</span>

                <span>
                  {formatCurrency(
                    saleForm.tax
                  )}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-4">
                <span className="font-semibold">
                  Total
                </span>

                <span className="text-xl font-bold">
                  {formatCurrency(
                    saleTotal
                  )}
                </span>
              </div>
            </div>

            <FormField
              label="Notes"
              name="notes"
              value={saleForm.notes}
              onChange={handleSaleChange}
              placeholder="Optional notes"
            />

            <ModalActions
              onCancel={() =>
                setShowSaleForm(false)
              }
              submitting={submitting}
              submitText="Create Sale"
            />
          </form>
        </Modal>
      )}

      {/* =====================================================
          PAYMENT MODAL
      ===================================================== */}

      {showPaymentForm && (
        <Modal
          title="Record Sale Payment"
          onClose={() =>
            setShowPaymentForm(false)
          }
        >
          <form
            onSubmit={handleCreatePayment}
            className="space-y-4"
          >
            <SelectField
              label="Sale"
              name="sale"
              value={paymentForm.sale}
              onChange={handlePaymentChange}
              options={[
                ["", "Select sale"],
                ...sales.map((sale) => [
                  sale._id,
                  `${sale.invoiceNumber} - ${formatCurrency(
                    sale.totalAmount
                  )}`,
                ]),
              ]}
              required
            />

            <FormField
              label="Amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={paymentForm.amount}
              onChange={handlePaymentChange}
              required
            />

            <FormField
              label="Payment Date"
              name="paymentDate"
              type="date"
              value={paymentForm.paymentDate}
              onChange={handlePaymentChange}
            />

            <SelectField
              label="Payment Method"
              name="paymentMethod"
              value={
                paymentForm.paymentMethod
              }
              onChange={handlePaymentChange}
              options={[
                ["cash", "Cash"],
                ["mpesa", "M-Pesa"],
                ["bank", "Bank"],
                ["cheque", "Cheque"],
                ["other", "Other"],
              ]}
            />

            <FormField
              label="Reference"
              name="reference"
              value={
                paymentForm.reference
              }
              onChange={handlePaymentChange}
              placeholder="M-Pesa / bank / receipt reference"
              required
            />

            <FormField
              label="Notes"
              name="notes"
              value={paymentForm.notes}
              onChange={handlePaymentChange}
            />

            <ModalActions
              onCancel={() =>
                setShowPaymentForm(false)
              }
              submitting={submitting}
              submitText="Record Payment"
            />
          </form>
        </Modal>
      )}
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| COMPONENTS
|--------------------------------------------------------------------------
*/

const SummaryCard = ({
  title,
  value,
  icon: Icon,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({
  title,
  buttonText,
  onClick,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-semibold text-slate-900">
        {title}
      </h2>

      <button
        onClick={onClick}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Plus size={17} />
        {buttonText}
      </button>
    </div>
  );
};

const SearchBox = ({
  value,
  onChange,
  placeholder,
}) => {
  return (
    <div className="relative">
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />

      <input
        className="form-input pl-10"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
      />
    </div>
  );
};

const TableHeader = ({ children }) => {
  return (
    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
};

const TableCell = ({
  children,
  strong = false,
}) => {
  return (
    <td
      className={`whitespace-nowrap px-5 py-4 ${
        strong
          ? "font-semibold text-slate-900"
          : "text-slate-600"
      }`}
    >
      {children}
    </td>
  );
};

const EmptyState = ({ text }) => {
  return (
    <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
};

const FormField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  min,
  step,
}) => {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}

      <input
        className="form-input"
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
      />
    </div>
  );
};

const SelectField = ({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
}) => {
  return (
    <div>
      <label className="form-label">
        {label}
      </label>

      <select
        className="form-input"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          )
        )}
      </select>
    </div>
  );
};

const Modal = ({
  title,
  children,
  onClose,
  wide = false,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${
          wide
            ? "max-w-5xl"
            : "max-w-2xl"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
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

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const ModalActions = ({
  onCancel,
  submitting,
  submitText = "Save",
}) => {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Saving..."
          : submitText}
      </button>
    </div>
  );
};

export default SalesPage;