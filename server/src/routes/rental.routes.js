import express from "express";

import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,

  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,

  createLease,
  getLeases,
  getLeaseById,
  updateLease,
  deleteLease,

  createRentPayment,
  getRentPayments,
  getRentPaymentById,
  updateRentPayment,
  deleteRentPayment,

  getRentalSummary,
} from "../controllers/rental.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(protect, authorizeModule("rentals"));

/*
|--------------------------------------------------------------------------
| RENTAL SUMMARY
|--------------------------------------------------------------------------
*/

router.get("/summary", getRentalSummary);

/*
|--------------------------------------------------------------------------
| PROPERTIES
|--------------------------------------------------------------------------
*/

router.post("/properties", createProperty);

router.get("/properties", getProperties);

router.get(
  "/properties/:id",
  getPropertyById
);

router.put(
  "/properties/:id",
  updateProperty
);

router.delete(
  "/properties/:id",
  deleteProperty
);

/*
|--------------------------------------------------------------------------
| TENANTS
|--------------------------------------------------------------------------
*/

router.post("/tenants", createTenant);

router.get("/tenants", getTenants);

router.get(
  "/tenants/:id",
  getTenantById
);

router.put(
  "/tenants/:id",
  updateTenant
);

router.delete(
  "/tenants/:id",
  deleteTenant
);

/*
|--------------------------------------------------------------------------
| LEASES
|--------------------------------------------------------------------------
*/

router.post("/leases", createLease);

router.get("/leases", getLeases);

router.get(
  "/leases/:id",
  getLeaseById
);

router.put(
  "/leases/:id",
  updateLease
);

router.delete(
  "/leases/:id",
  deleteLease
);

/*
|--------------------------------------------------------------------------
| RENT PAYMENTS
|--------------------------------------------------------------------------
*/

router.post(
  "/payments",
  createRentPayment
);

router.get(
  "/payments",
  getRentPayments
);

router.get(
  "/payments/:id",
  getRentPaymentById
);

router.put(
  "/payments/:id",
  updateRentPayment
);

router.delete(
  "/payments/:id",
  deleteRentPayment
);

export default router;