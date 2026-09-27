import Property from "../models/Property.js";
import Tenant from "../models/Tenant.js";
import Lease from "../models/Lease.js";
import RentPayment from "../models/RentPayment.js";

/*
|--------------------------------------------------------------------------
| PROPERTY MANAGEMENT
|--------------------------------------------------------------------------
*/

// CREATE PROPERTY
export const createProperty = async (req, res, next) => {
  try {
    const property = await Property.create(req.body);

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL PROPERTIES
export const getProperties = async (req, res, next) => {
  try {
    const properties = await Property.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

// GET PROPERTY BY ID
export const getPropertyById = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PROPERTY
export const updateProperty = async (req, res, next) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE PROPERTY
export const deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findByIdAndDelete(
      req.params.id
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| TENANT MANAGEMENT
|--------------------------------------------------------------------------
*/

// CREATE TENANT
export const createTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.create(req.body);

    const populatedTenant = await Tenant.findById(
      tenant._id
    ).populate("property");

    res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      data: populatedTenant,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL TENANTS
export const getTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.find()
      .populate("property")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tenants.length,
      data: tenants,
    });
  } catch (error) {
    next(error);
  }
};

// GET TENANT BY ID
export const getTenantById = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id).populate(
      "property"
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE TENANT
export const updateTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("property");

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    res.json({
      success: true,
      message: "Tenant updated successfully",
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE TENANT
export const deleteTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(
      req.params.id
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    res.json({
      success: true,
      message: "Tenant deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| LEASE MANAGEMENT
|--------------------------------------------------------------------------
*/

// CREATE LEASE
export const createLease = async (req, res, next) => {
  try {
    const {
      tenant,
      property,
      unitNumber,
      leaseStart,
      leaseEnd,
      monthlyRent,
    } = req.body;

    if (
      !tenant ||
      !property ||
      !unitNumber ||
      !leaseStart ||
      !leaseEnd ||
      monthlyRent === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Tenant, property, unit number, lease dates and monthly rent are required",
      });
    }

    if (new Date(leaseEnd) <= new Date(leaseStart)) {
      return res.status(400).json({
        success: false,
        message: "Lease end date must be after lease start date",
      });
    }

    const tenantExists = await Tenant.findById(tenant);

    if (!tenantExists) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const propertyExists = await Property.findById(property);

    if (!propertyExists) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const lease = await Lease.create(req.body);

    const populatedLease = await Lease.findById(
      lease._id
    )
      .populate("tenant")
      .populate("property");

    res.status(201).json({
      success: true,
      message: "Lease created successfully",
      data: populatedLease,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL LEASES
export const getLeases = async (req, res, next) => {
  try {
    const leases = await Lease.find()
      .populate("tenant")
      .populate("property")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: leases.length,
      data: leases,
    });
  } catch (error) {
    next(error);
  }
};

// GET LEASE BY ID
export const getLeaseById = async (req, res, next) => {
  try {
    const lease = await Lease.findById(req.params.id)
      .populate("tenant")
      .populate("property");

    if (!lease) {
      return res.status(404).json({
        success: false,
        message: "Lease not found",
      });
    }

    res.json({
      success: true,
      data: lease,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE LEASE
export const updateLease = async (req, res, next) => {
  try {
    if (
      req.body.leaseStart &&
      req.body.leaseEnd &&
      new Date(req.body.leaseEnd) <=
        new Date(req.body.leaseStart)
    ) {
      return res.status(400).json({
        success: false,
        message: "Lease end date must be after lease start date",
      });
    }

    const lease = await Lease.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("tenant")
      .populate("property");

    if (!lease) {
      return res.status(404).json({
        success: false,
        message: "Lease not found",
      });
    }

    res.json({
      success: true,
      message: "Lease updated successfully",
      data: lease,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE LEASE
export const deleteLease = async (req, res, next) => {
  try {
    const lease = await Lease.findByIdAndDelete(
      req.params.id
    );

    if (!lease) {
      return res.status(404).json({
        success: false,
        message: "Lease not found",
      });
    }

    res.json({
      success: true,
      message: "Lease deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| RENT PAYMENT MANAGEMENT
|--------------------------------------------------------------------------
*/

// RECORD RENT PAYMENT
export const createRentPayment = async (
  req,
  res,
  next
) => {
  try {
    const {
      tenant,
      lease,
      property,
      unitNumber,
      amount,
      paymentMethod,
      reference,
      period,
    } = req.body;

    if (
      !tenant ||
      !lease ||
      !property ||
      !unitNumber ||
      amount === undefined ||
      !paymentMethod ||
      !reference ||
      !period
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Tenant, lease, property, unit, amount, payment method, reference and period are required",
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const [tenantExists, leaseExists, propertyExists] =
      await Promise.all([
        Tenant.findById(tenant),
        Lease.findById(lease),
        Property.findById(property),
      ]);

    if (!tenantExists) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!leaseExists) {
      return res.status(404).json({
        success: false,
        message: "Lease not found",
      });
    }

    if (!propertyExists) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const existingPayment = await RentPayment.findOne({
      reference,
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "A payment with this reference already exists",
      });
    }

    const payment = await RentPayment.create({
      ...req.body,
      recordedBy: req.user?._id,
    });

    const populatedPayment = await RentPayment.findById(
      payment._id
    )
      .populate("tenant")
      .populate("lease")
      .populate("property")
      .populate("recordedBy", "name email");

    res.status(201).json({
      success: true,
      message: "Rent payment recorded successfully",
      data: populatedPayment,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL RENT PAYMENTS
export const getRentPayments = async (
  req,
  res,
  next
) => {
  try {
    const payments = await RentPayment.find()
      .populate("tenant")
      .populate("lease")
      .populate("property")
      .populate("recordedBy", "name email")
      .sort({ paymentDate: -1 });

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// GET RENT PAYMENT BY ID
export const getRentPaymentById = async (
  req,
  res,
  next
) => {
  try {
    const payment = await RentPayment.findById(
      req.params.id
    )
      .populate("tenant")
      .populate("lease")
      .populate("property")
      .populate("recordedBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Rent payment not found",
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE RENT PAYMENT
export const updateRentPayment = async (
  req,
  res,
  next
) => {
  try {
    const payment = await RentPayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("tenant")
      .populate("lease")
      .populate("property")
      .populate("recordedBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Rent payment not found",
      });
    }

    res.json({
      success: true,
      message: "Rent payment updated successfully",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE RENT PAYMENT
export const deleteRentPayment = async (
  req,
  res,
  next
) => {
  try {
    const payment = await RentPayment.findByIdAndDelete(
      req.params.id
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Rent payment not found",
      });
    }

    res.json({
      success: true,
      message: "Rent payment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| RENTAL SUMMARY
|--------------------------------------------------------------------------
*/

export const getRentalSummary = async (
  req,
  res,
  next
) => {
  try {
    const [
      propertyCount,
      tenantCount,
      activeLeaseCount,
      paymentSummary,
    ] = await Promise.all([
      Property.countDocuments(),

      Tenant.countDocuments({
        status: "active",
      }),

      Lease.countDocuments({
        status: "active",
      }),

      RentPayment.aggregate([
        {
          $match: {
            status: "confirmed",
          },
        },
        {
          $group: {
            _id: null,
            totalCollected: {
              $sum: "$amount",
            },
          },
        },
      ]),
    ]);

    const totalCollected =
      paymentSummary.length > 0
        ? paymentSummary[0].totalCollected
        : 0;

    res.json({
      success: true,
      data: {
        properties: propertyCount,
        activeTenants: tenantCount,
        activeLeases: activeLeaseCount,
        totalRentCollected: totalCollected,
      },
    });
  } catch (error) {
    next(error);
  }
};