import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const productFields = [
  "name", "category", "sku", "unit", "sellingPrice", "stockQuantity", "status",
];
const customerFields = [
  "customerCode", "name", "phone", "email", "address", "taxNumber",
  "customerType", "creditLimit", "status",
];
const saleInclude = {
  customer: true,
  items: { include: { product: true } },
  createdBy: { select: { id: true, name: true, email: true } },
};
const paymentInclude = {
  sale: true,
  customer: true,
  recordedBy: { select: { id: true, name: true, email: true } },
};

const notFoundUpdate = (error) => {
  if (error.code === "P2025") return null;
  throw error;
};

const paymentTotals = async (transaction, saleId) => {
  const summary = await transaction.salePayment.aggregate({
    where: { saleId, status: "confirmed" },
    _sum: { amount: true },
  });
  return Number(summary._sum.amount || 0);
};

const paymentState = (totalAmount, totalPaid) => {
  const balanceDue = Math.max(Number(totalAmount) - totalPaid, 0);
  let paymentStatus = "unpaid";
  if (totalPaid === 0) paymentStatus = "unpaid";
  else if (totalPaid < Number(totalAmount)) paymentStatus = "partially_paid";
  else if (totalPaid === Number(totalAmount)) paymentStatus = "paid";
  else paymentStatus = "overpaid";
  return { amountPaid: totalPaid, balanceDue, paymentStatus };
};

const relationId = (value) => value && typeof value === "object"
  ? value.id || value._id
  : value;

const normalizeSaleItems = async (transaction, items) => {
  const processedItems = [];
  let subtotal = 0;
  for (const item of items) {
    if (!item.product || !item.quantity) {
      return { error: "Each sale item must contain a product and quantity" };
    }
    const product = await transaction.product.findUnique({
      where: { id: relationId(item.product) },
    });
    if (!product) return { error: `Product not found: ${relationId(item.product)}`, status: 404 };
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice ?? product.sellingPrice ?? 0);
    const discount = Number(item.discount || 0);
    const tax = Number(item.tax || 0);
    if (quantity <= 0) return { error: "Sale item quantity must be greater than zero" };
    if (unitPrice < 0) return { error: "Sale item unit price cannot be negative" };
    const itemSubtotal = quantity * unitPrice;
    const total = itemSubtotal - discount + tax;
    if (total < 0) return { error: "Sale item total cannot be negative" };
    subtotal += total;
    processedItems.push({
      productId: product.id,
      description: item.description || product.name,
      quantity,
      unitPrice,
      discount,
      tax,
      total,
    });
  }
  return { items: processedItems, subtotal };
};

export const createProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.create({
      data: prismaData(req.body, productFields),
    });
    res.status(201).json({ success: true, message: "Product created", data: serializePrismaRecord(product) });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: products.length,
      data: serializePrismaRecord(products),
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, data: serializePrismaRecord(product) });
  } catch (error) {
    return next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: prismaData(req.body, productFields),
    }).catch(notFoundUpdate);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({
      success: true,
      message: "Product updated",
      data: serializePrismaRecord(product),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.delete({ where: { id: req.params.id } }).catch(notFoundUpdate);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    return next(error);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const data = prismaData(req.body, customerFields);
    if (data.email != null) data.email = String(data.email).trim().toLowerCase();
    if (data.name != null) data.name = String(data.name).trim();
    if (data.customerCode != null) data.customerCode = String(data.customerCode).trim();
    const customer = await prisma.customer.create({ data });
    res.status(201).json({
      success: true,
      message: "Customer created",
      data: serializePrismaRecord(customer),
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      count: customers.length,
      data: serializePrismaRecord(customers),
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    return res.json({ success: true, data: serializePrismaRecord(customer) });
  } catch (error) {
    return next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const data = prismaData(req.body, customerFields);
    if (data.email != null) data.email = String(data.email).trim().toLowerCase();
    if (data.name != null) data.name = String(data.name).trim();
    if (data.customerCode != null) data.customerCode = String(data.customerCode).trim();
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    }).catch(notFoundUpdate);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    return res.json({
      success: true,
      message: "Customer updated",
      data: serializePrismaRecord(customer),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await prisma.customer.delete({
      where: { id: req.params.id },
    }).catch(notFoundUpdate);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    return res.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    return next(error);
  }
};

export const createSale = async (req, res, next) => {
  try {
    const {
      invoiceNumber,
      customer: customerId,
      items,
      discount = 0,
      tax = 0,
      amountPaid = 0,
      paymentMethod = "cash",
      saleDate,
      status = "draft",
      notes,
    } = req.body;
    if (!invoiceNumber || !customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invoice number, customer and at least one sale item are required",
      });
    }
    const normalizedInvoiceNumber = String(invoiceNumber).trim();
    const result = await prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: relationId(customerId) } });
      if (!customer) return { status: 404, message: "Customer not found" };
      const existing = await transaction.sale.findUnique({ where: { invoiceNumber: normalizedInvoiceNumber } });
      if (existing) {
        return { status: 409, message: "A sale with this invoice number already exists" };
      }
      const normalized = await normalizeSaleItems(transaction, items);
      if (normalized.error) return { status: normalized.status || 400, message: normalized.error };
      const saleDiscount = Number(discount || 0);
      const saleTax = Number(tax || 0);
      const paid = Number(amountPaid || 0);
      const totalAmount = normalized.subtotal - saleDiscount + saleTax;
      if (totalAmount < 0) return { status: 400, message: "Sale total cannot be negative" };
      if (paid < 0) return { status: 400, message: "Amount paid cannot be negative" };
      const payment = paymentState(totalAmount, paid);
      const sale = await transaction.sale.create({
        data: {
          invoiceNumber: normalizedInvoiceNumber,
          customerId: customer.id,
          saleDate: saleDate ? new Date(saleDate) : new Date(),
          items: { create: normalized.items },
          subtotal: normalized.subtotal,
          discount: saleDiscount,
          tax: saleTax,
          totalAmount,
          amountPaid: paid,
          balanceDue: payment.balanceDue,
          paymentStatus: payment.paymentStatus,
          paymentMethod,
          status,
          notes,
          createdById: req.user?.id,
        },
        include: saleInclude,
      });
      return { sale };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.status(201).json({
      success: true,
      message: "Sale recorded successfully",
      data: serializePrismaRecord(result.sale),
    });
  } catch (error) {
    return next(error);
  }
};

export const getSales = async (req, res, next) => {
  try {
    const sales = await prisma.sale.findMany({
      include: saleInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, count: sales.length, data: serializePrismaRecord(sales) });
  } catch (error) {
    next(error);
  }
};

export const getSaleById = async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: saleInclude,
    });
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    return res.json({ success: true, data: serializePrismaRecord(sale) });
  } catch (error) {
    return next(error);
  }
};

export const updateSale = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findUnique({ where: { id: req.params.id } });
      if (!sale) return { status: 404, message: "Sale not found" };
      if (req.body.invoiceNumber && req.body.invoiceNumber !== sale.invoiceNumber) {
        const duplicate = await transaction.sale.findFirst({
          where: {
            invoiceNumber: String(req.body.invoiceNumber).trim(),
            id: { not: sale.id },
          },
        });
        if (duplicate) {
          return { status: 409, message: "Another sale already uses this invoice number" };
        }
      }
      const fields = [
        "invoiceNumber", "saleDate", "subtotal", "discount", "tax", "totalAmount",
        "amountPaid", "balanceDue", "paymentStatus", "paymentMethod", "status", "notes",
      ];
      const data = prismaData(req.body, fields, {}, ["saleDate"]);
      if (data.invoiceNumber !== undefined) data.invoiceNumber = String(data.invoiceNumber).trim();
      if (Object.hasOwn(req.body, "customer")) data.customerId = relationId(req.body.customer);
      if (Array.isArray(req.body.items)) {
        data.items = {
          deleteMany: {},
          create: req.body.items.map((item) => ({
            productId: relationId(item.product || item.productId),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0,
            tax: item.tax ?? 0,
            total: item.total,
          })),
        };
      }
      const updatedSale = await transaction.sale.update({
        where: { id: sale.id },
        data,
        include: saleInclude,
      });
      return { sale: updatedSale };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      message: "Sale updated successfully",
      data: serializePrismaRecord(result.sale),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSale = async (req, res, next) => {
  try {
    const sale = await prisma.$transaction(async (transaction) => {
      const current = await transaction.sale.findUnique({ where: { id: req.params.id } });
      if (!current) return null;
      await transaction.salePayment.deleteMany({ where: { saleId: current.id } });
      return transaction.sale.delete({ where: { id: current.id } });
    });
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    return res.json({ success: true, message: "Sale deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const createSalePayment = async (req, res, next) => {
  try {
    const {
      sale: saleId,
      amount,
      paymentDate,
      paymentMethod,
      reference,
      status = "confirmed",
      notes,
    } = req.body;
    if (!saleId || amount === undefined || !paymentMethod || !reference) {
      return res.status(400).json({
        success: false,
        message: "Sale, amount, payment method and reference are required",
      });
    }
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }
    const normalizedReference = String(reference).trim();
    const result = await prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findUnique({ where: { id: saleId } });
      if (!sale) return { status: 404, message: "Sale not found" };
      if (sale.status === "cancelled") {
        return { status: 400, message: "Payments cannot be recorded against a cancelled sale" };
      }
      if (await transaction.salePayment.findUnique({ where: { reference: normalizedReference } })) {
        return { status: 409, message: "A payment with this reference already exists" };
      }
      const payment = await transaction.salePayment.create({
        data: {
          saleId,
          customerId: sale.customerId,
          amount: paymentAmount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod,
          reference: normalizedReference,
          status,
          notes,
          recordedById: req.user?.id,
        },
      });
      const totalPaid = await paymentTotals(transaction, sale.id);
      await transaction.sale.update({
        where: { id: sale.id },
        data: paymentState(sale.totalAmount, totalPaid),
      });
      const populated = await transaction.salePayment.findUnique({
        where: { id: payment.id },
        include: paymentInclude,
      });
      return { payment: populated };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.status(201).json({
      success: true,
      message: "Sale payment recorded successfully",
      data: serializePrismaRecord(result.payment),
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A payment with this reference already exists",
      });
    }
    return next(error);
  }
};

export const getSalePayments = async (req, res, next) => {
  try {
    const payments = await prisma.salePayment.findMany({
      include: paymentInclude,
      orderBy: { paymentDate: "desc" },
    });
    res.json({
      success: true,
      count: payments.length,
      data: serializePrismaRecord(payments),
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentsBySale = async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.saleId } });
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    const payments = await prisma.salePayment.findMany({
      where: { saleId: sale.id },
      include: {
        customer: true,
        recordedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { paymentDate: "desc" },
    });
    return res.json({
      success: true,
      count: payments.length,
      data: serializePrismaRecord(payments),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSalePayment = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const payment = await transaction.salePayment.findUnique({ where: { id: req.params.id } });
      if (!payment) return { status: 404, message: "Sale payment not found" };
      await transaction.salePayment.delete({ where: { id: payment.id } });
      const sale = await transaction.sale.findUnique({ where: { id: payment.saleId } });
      if (sale) {
        const totalPaid = await paymentTotals(transaction, sale.id);
        await transaction.sale.update({
          where: { id: sale.id },
          data: paymentState(sale.totalAmount, totalPaid),
        });
      }
      return { payment };
    }, { isolationLevel: "Serializable" });
    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({ success: true, message: "Sale payment deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getSalesSummary = async (req, res, next) => {
  try {
    const where = { status: { not: "cancelled" } };
    const [customers, sales, totals, outstanding] = await Promise.all([
      prisma.customer.count({ where: { status: "active" } }),
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where,
        _sum: { totalAmount: true, amountPaid: true },
      }),
      prisma.sale.aggregate({
        where: { ...where, balanceDue: { gt: 0 } },
        _sum: { balanceDue: true },
      }),
    ]);
    res.json({
      success: true,
      data: {
        customers,
        sales,
        totalSales: Number(totals._sum.totalAmount || 0),
        totalPaid: Number(totals._sum.amountPaid || 0),
        outstanding: Number(outstanding._sum.balanceDue || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};
