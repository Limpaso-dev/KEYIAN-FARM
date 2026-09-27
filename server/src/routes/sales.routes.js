import express from "express";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,

  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,

  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,

  createSalePayment,
  getSalePayments,
  getPaymentsBySale,
  deleteSalePayment,

  getSalesSummary,
} from "../controllers/sales.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/*
|--------------------------------------------------------------------------
| SALES SUMMARY
|--------------------------------------------------------------------------
*/

router.get("/summary", getSalesSummary);

/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
*/

router.post("/products", createProduct);
router.get("/products", getProducts);
router.get("/products/:id", getProductById);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

/*
|--------------------------------------------------------------------------
| CUSTOMERS
|--------------------------------------------------------------------------
*/

router.post("/customers", createCustomer);
router.get("/customers", getCustomers);
router.get("/customers/:id", getCustomerById);
router.put("/customers/:id", updateCustomer);
router.delete("/customers/:id", deleteCustomer);

/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
| IMPORTANT:
| These routes MUST appear BEFORE /:id.
|--------------------------------------------------------------------------
*/

router.post("/payments", createSalePayment);
router.get("/payments", getSalePayments);
router.get("/payments/sale/:saleId", getPaymentsBySale);
router.delete("/payments/:id", deleteSalePayment);

/*
|--------------------------------------------------------------------------
| SALES
|--------------------------------------------------------------------------
*/

router.post("/", createSale);
router.get("/", getSales);
router.get("/:id", getSaleById);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;