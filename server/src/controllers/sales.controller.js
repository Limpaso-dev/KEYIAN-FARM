import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import SalePayment from "../models/SalePayment.js";

// ===============================
// PRODUCTS
// ===============================

export const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      message: "Product created",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product updated",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// CUSTOMERS
// ===============================

export const createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);

    res.status(201).json({
      success: true,
      message: "Customer created",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer updated",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(
      req.params.id
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer deleted",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// SALES
// ===============================

export const createSale = async (req, res, next) => {
  try {
    const {
      invoiceNumber,
      customer,
      items,
      discount = 0,
      tax = 0,
      amountPaid = 0,
      paymentMethod = "cash",
      saleDate,
      status = "draft",
      notes,
    } = req.body;

    if (
      !invoiceNumber ||
      !customer ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice number, customer and at least one sale item are required",
      });
    }

    // Check customer
    const customerExists = await Customer.findById(
      customer
    );

    if (!customerExists) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check duplicate invoice
    const existingInvoice = await Sale.findOne({
      invoiceNumber,
    });

    if (existingInvoice) {
      return res.status(409).json({
        success: false,
        message:
          "A sale with this invoice number already exists",
      });
    }

    /*
     * Build sale items using current product information.
     */
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      if (!item.product || !item.quantity) {
        return res.status(400).json({
          success: false,
          message:
            "Each sale item must contain a product and quantity",
        });
      }

      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      const quantity = Number(item.quantity);
      const unitPrice = Number(
        item.unitPrice ?? product.sellingPrice ?? 0
      );

      const itemDiscount = Number(
        item.discount || 0
      );

      const itemTax = Number(item.tax || 0);

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Sale item quantity must be greater than zero",
        });
      }

      if (unitPrice < 0) {
        return res.status(400).json({
          success: false,
          message:
            "Sale item unit price cannot be negative",
        });
      }

      const itemSubtotal =
        quantity * unitPrice;

      const itemTotal =
        itemSubtotal -
        itemDiscount +
        itemTax;

      if (itemTotal < 0) {
        return res.status(400).json({
          success: false,
          message:
            "Sale item total cannot be negative",
        });
      }

      subtotal += itemTotal;

      processedItems.push({
        product: product._id,
        description:
          item.description || product.name,
        quantity,
        unitPrice,
        discount: itemDiscount,
        tax: itemTax,
        total: itemTotal,
      });
    }

    const saleDiscount = Number(discount || 0);
    const saleTax = Number(tax || 0);
    const paid = Number(amountPaid || 0);

    const totalAmount =
      subtotal -
      saleDiscount +
      saleTax;

    if (totalAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Sale total cannot be negative",
      });
    }

    if (paid < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Amount paid cannot be negative",
      });
    }

    const balanceDue =
      totalAmount - paid;

    let paymentStatus = "unpaid";

    if (paid === 0) {
      paymentStatus = "unpaid";
    } else if (paid < totalAmount) {
      paymentStatus = "partially_paid";
    } else if (paid === totalAmount) {
      paymentStatus = "paid";
    } else {
      paymentStatus = "overpaid";
    }

    const sale = await Sale.create({
      invoiceNumber,
      customer,
      saleDate: saleDate || Date.now(),
      items: processedItems,
      subtotal,
      discount: saleDiscount,
      tax: saleTax,
      totalAmount,
      amountPaid: paid,
      balanceDue: Math.max(balanceDue, 0),
      paymentStatus,
      paymentMethod,
      status,
      notes,
      createdBy: req.user?._id,
    });

    const populatedSale = await Sale.findById(
      sale._id
    )
      .populate("customer")
      .populate("items.product")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Sale recorded successfully",
      data: populatedSale,
    });
  } catch (error) {
    next(error);
  }
};

// GET SALES
export const getSales = async (req, res, next) => {
  try {
    const sales = await Sale.find()
      .populate("customer")
      .populate("items.product")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// GET SALE BY ID
export const getSaleById = async (
  req,
  res,
  next
) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("customer")
      .populate("items.product")
      .populate("createdBy", "name email");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE SALE
export const updateSale = async (
  req,
  res,
  next
) => {
  try {
    const sale = await Sale.findById(
      req.params.id
    );

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    /*
     * Do not allow changing the invoice number
     * to one already used by another sale.
     */
    if (
      req.body.invoiceNumber &&
      req.body.invoiceNumber !==
        sale.invoiceNumber
    ) {
      const duplicate = await Sale.findOne({
        invoiceNumber:
          req.body.invoiceNumber,
        _id: { $ne: sale._id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "Another sale already uses this invoice number",
        });
      }
    }

    const updatedSale =
      await Sale.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("customer")
        .populate("items.product")
        .populate("createdBy", "name email");

    res.json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE SALE
export const deleteSale = async (
  req,
  res,
  next
) => {
  try {
    const sale = await Sale.findByIdAndDelete(
      req.params.id
    );

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Remove payments belonging to this sale.
    await SalePayment.deleteMany({
      sale: sale._id,
    });

    res.json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// SALE PAYMENTS
// ===============================

export const createSalePayment = async (
  req,
  res,
  next
) => {
  try {
    const {
      sale,
      amount,
      paymentDate,
      paymentMethod,
      reference,
      status = "confirmed",
      notes,
    } = req.body;

    if (
      !sale ||
      amount === undefined ||
      !paymentMethod ||
      !reference
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Sale, amount, payment method and reference are required",
      });
    }

    const paymentAmount = Number(amount);

    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero",
      });
    }

    const saleExists = await Sale.findById(sale);

    if (!saleExists) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    if (saleExists.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message:
          "Payments cannot be recorded against a cancelled sale",
      });
    }

    const existingReference =
      await SalePayment.findOne({
        reference,
      });

    if (existingReference) {
      return res.status(409).json({
        success: false,
        message:
          "A payment with this reference already exists",
      });
    }

    const payment =
      await SalePayment.create({
        sale,
        customer: saleExists.customer,
        amount: paymentAmount,
        paymentDate:
          paymentDate || Date.now(),
        paymentMethod,
        reference,
        status,
        notes,
        recordedBy: req.user?._id,
      });

    /*
     * Recalculate the sale's confirmed payments.
     */
    const paymentSummary =
      await SalePayment.aggregate([
        {
          $match: {
            sale: saleExists._id,
            status: "confirmed",
          },
        },
        {
          $group: {
            _id: null,
            totalPaid: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const totalPaid =
      paymentSummary.length > 0
        ? paymentSummary[0].totalPaid
        : 0;

    const balanceDue = Math.max(
      saleExists.totalAmount - totalPaid,
      0
    );

    let paymentStatus = "unpaid";

    if (totalPaid === 0) {
      paymentStatus = "unpaid";
    } else if (
      totalPaid < saleExists.totalAmount
    ) {
      paymentStatus = "partially_paid";
    } else if (
      totalPaid === saleExists.totalAmount
    ) {
      paymentStatus = "paid";
    } else {
      paymentStatus = "overpaid";
    }

    await Sale.findByIdAndUpdate(
      saleExists._id,
      {
        amountPaid: totalPaid,
        balanceDue,
        paymentStatus,
      }
    );

    const populatedPayment =
      await SalePayment.findById(
        payment._id
      )
        .populate("sale")
        .populate("customer")
        .populate(
          "recordedBy",
          "name email"
        );

    res.status(201).json({
      success: true,
      message:
        "Sale payment recorded successfully",
      data: populatedPayment,
    });
  } catch (error) {
    next(error);
  }
};

// GET SALE PAYMENTS
export const getSalePayments = async (
  req,
  res,
  next
) => {
  try {
    const payments =
      await SalePayment.find()
        .populate("sale")
        .populate("customer")
        .populate(
          "recordedBy",
          "name email"
        )
        .sort({
          paymentDate: -1,
        });

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// GET PAYMENTS FOR A SALE
export const getPaymentsBySale = async (
  req,
  res,
  next
) => {
  try {
    const sale = await Sale.findById(
      req.params.saleId
    );

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const payments =
      await SalePayment.find({
        sale: sale._id,
      })
        .populate("customer")
        .populate(
          "recordedBy",
          "name email"
        )
        .sort({
          paymentDate: -1,
        });

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE SALE PAYMENT
export const deleteSalePayment = async (
  req,
  res,
  next
) => {
  try {
    const payment =
      await SalePayment.findById(
        req.params.id
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Sale payment not found",
      });
    }

    const sale =
      await Sale.findById(payment.sale);

    await SalePayment.findByIdAndDelete(
      payment._id
    );

    if (sale) {
      const paymentSummary =
        await SalePayment.aggregate([
          {
            $match: {
              sale: sale._id,
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: null,
              totalPaid: {
                $sum: "$amount",
              },
            },
          },
        ]);

      const totalPaid =
        paymentSummary.length > 0
          ? paymentSummary[0].totalPaid
          : 0;

      const balanceDue = Math.max(
        sale.totalAmount - totalPaid,
        0
      );

      let paymentStatus = "unpaid";

      if (totalPaid === 0) {
        paymentStatus = "unpaid";
      } else if (
        totalPaid < sale.totalAmount
      ) {
        paymentStatus = "partially_paid";
      } else if (
        totalPaid === sale.totalAmount
      ) {
        paymentStatus = "paid";
      } else {
        paymentStatus = "overpaid";
      }

      await Sale.findByIdAndUpdate(
        sale._id,
        {
          amountPaid: totalPaid,
          balanceDue,
          paymentStatus,
        }
      );
    }

    res.json({
      success: true,
      message:
        "Sale payment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// SALES SUMMARY
// ===============================

export const getSalesSummary = async (
  req,
  res,
  next
) => {
  try {
    const [
      customerCount,
      saleCount,
      revenueSummary,
      outstandingSummary,
    ] = await Promise.all([
      Customer.countDocuments({
        status: "active",
      }),

      Sale.countDocuments({
        status: {
          $ne: "cancelled",
        },
      }),

      Sale.aggregate([
        {
          $match: {
            status: {
              $ne: "cancelled",
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: {
              $sum: "$totalAmount",
            },
            totalPaid: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),

      Sale.aggregate([
        {
          $match: {
            status: {
              $ne: "cancelled",
            },
            balanceDue: {
              $gt: 0,
            },
          },
        },
        {
          $group: {
            _id: null,
            outstanding: {
              $sum: "$balanceDue",
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        customers: customerCount,
        sales: saleCount,
        totalSales:
          revenueSummary.length > 0
            ? revenueSummary[0].totalSales
            : 0,
        totalPaid:
          revenueSummary.length > 0
            ? revenueSummary[0].totalPaid
            : 0,
        outstanding:
          outstandingSummary.length > 0
            ? outstandingSummary[0].outstanding
            : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};