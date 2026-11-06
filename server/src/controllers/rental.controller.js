import prisma from "../config/prisma.js";
import { prismaData, serializePrismaRecord } from "../utils/prismaRecords.js";

const propertyInclude = { units: { orderBy: { unitNumber: "asc" } } };
const tenantInclude = { property: true };
const leaseInclude = { tenant: true, property: true };
const rentPaymentInclude = {
  tenant: true,
  lease: true,
  property: true,
  recordedBy: { select: { id: true, name: true, email: true } },
};

const notFoundUpdate = (error) => {
  if (error.code === "P2025") return null;
  throw error;
};

const propertyDataFields = ["name", "location", "propertyType"];
const tenantDataFields = [
  "name", "phone", "email", "propertyId", "unitNumber", "leaseStart", "leaseEnd", "monthlyRent", "status",
];
const leaseDataFields = [
  "tenantId", "propertyId", "unitNumber", "leaseStart", "leaseEnd",
  "monthlyRent", "securityDeposit", "paymentDueDay", "status", "notes",
];
const rentPaymentDataFields = [
  "tenantId", "leaseId", "propertyId", "unitNumber", "amount", "paymentDate",
  "paymentMethod", "reference", "period", "status", "notes", "recordedById",
];

export const createProperty = async (req, res, next) => {
  try {
    const data = prismaData(req.body, propertyDataFields);
    if (Array.isArray(req.body.units)) {
      data.units = {
        create: req.body.units.map((unit) => ({
          unitNumber: unit.unitNumber,
          monthlyRent: unit.monthlyRent,
          status: unit.status,
        })),
      };
    }
    const property = await prisma.property.create({ data, include: propertyInclude });
    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: serializePrismaRecord(property),
    });
  } catch (error) {
    next(error);
  }
};

export const getProperties = async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      include: propertyInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      count: properties.length,
      data: serializePrismaRecord(properties),
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyById = async (req, res, next) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: propertyInclude,
    });
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    return res.json({ success: true, data: serializePrismaRecord(property) });
  } catch (error) {
    return next(error);
  }
};

export const updateProperty = async (req, res, next) => {
  try {
    const data = prismaData(req.body, propertyDataFields);
    if (Array.isArray(req.body.units)) {
      data.units = {
        deleteMany: {},
        create: req.body.units.map((unit) => ({
          unitNumber: unit.unitNumber,
          monthlyRent: unit.monthlyRent,
          status: unit.status,
        })),
      };
    }
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data,
      include: propertyInclude,
    }).catch(notFoundUpdate);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    return res.json({
      success: true,
      message: "Property updated successfully",
      data: serializePrismaRecord(property),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteProperty = async (req, res, next) => {
  try {
    const property = await prisma.property.delete({
      where: { id: req.params.id },
    }).catch(notFoundUpdate);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    return res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const createTenant = async (req, res, next) => {
  try {
    const data = prismaData(req.body, tenantDataFields, { property: "propertyId" }, [
      "leaseStart", "leaseEnd",
    ]);
    const tenant = await prisma.tenant.create({
      data,
      include: tenantInclude,
    });
    res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      data: serializePrismaRecord(tenant),
    });
  } catch (error) {
    next(error);
  }
};

export const getTenants = async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: tenantInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      count: tenants.length,
      data: serializePrismaRecord(tenants),
    });
  } catch (error) {
    next(error);
  }
};

export const getTenantById = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: tenantInclude,
    });
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    return res.json({ success: true, data: serializePrismaRecord(tenant) });
  } catch (error) {
    return next(error);
  }
};

export const updateTenant = async (req, res, next) => {
  try {
    const data = prismaData(req.body, tenantDataFields, { property: "propertyId" }, [
      "leaseStart", "leaseEnd",
    ]);
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data,
      include: tenantInclude,
    }).catch(notFoundUpdate);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    return res.json({
      success: true,
      message: "Tenant updated successfully",
      data: serializePrismaRecord(tenant),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteTenant = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.delete({
      where: { id: req.params.id },
    }).catch(notFoundUpdate);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    return res.json({ success: true, message: "Tenant deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const createLease = async (req, res, next) => {
  try {
    const {
      tenant: tenantId,
      property: propertyId,
      unitNumber,
      leaseStart,
      leaseEnd,
      monthlyRent,
    } = req.body;
    if (!tenantId || !propertyId || !unitNumber || !leaseStart || !leaseEnd ||
        monthlyRent === undefined) {
      return res.status(400).json({
        success: false,
        message: "Tenant, property, unit number, lease dates and monthly rent are required",
      });
    }
    if (new Date(leaseEnd) <= new Date(leaseStart)) {
      return res.status(400).json({
        success: false,
        message: "Lease end date must be after lease start date",
      });
    }
    const [tenant, property] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.property.findUnique({ where: { id: propertyId } }),
    ]);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    const data = prismaData(req.body, leaseDataFields, {
      tenant: "tenantId",
      property: "propertyId",
    }, ["leaseStart", "leaseEnd"]);
    if (data.unitNumber !== undefined) data.unitNumber = String(data.unitNumber).trim();
    if (data.notes !== undefined && data.notes !== null) data.notes = String(data.notes).trim();
    data.tenantId = tenantId;
    data.propertyId = propertyId;
    const lease = await prisma.lease.create({ data, include: leaseInclude });
    return res.status(201).json({
      success: true,
      message: "Lease created successfully",
      data: serializePrismaRecord(lease),
    });
  } catch (error) {
    return next(error);
  }
};

export const getLeases = async (req, res, next) => {
  try {
    const leases = await prisma.lease.findMany({
      include: leaseInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, count: leases.length, data: serializePrismaRecord(leases) });
  } catch (error) {
    next(error);
  }
};

export const getLeaseById = async (req, res, next) => {
  try {
    const lease = await prisma.lease.findUnique({
      where: { id: req.params.id },
      include: leaseInclude,
    });
    if (!lease) return res.status(404).json({ success: false, message: "Lease not found" });
    return res.json({ success: true, data: serializePrismaRecord(lease) });
  } catch (error) {
    return next(error);
  }
};

export const updateLease = async (req, res, next) => {
  try {
    if (req.body.leaseStart && req.body.leaseEnd &&
        new Date(req.body.leaseEnd) <= new Date(req.body.leaseStart)) {
      return res.status(400).json({
        success: false,
        message: "Lease end date must be after lease start date",
      });
    }
    const data = prismaData(req.body, leaseDataFields, {
      tenant: "tenantId",
      property: "propertyId",
    }, ["leaseStart", "leaseEnd"]);
    if (data.unitNumber !== undefined) data.unitNumber = String(data.unitNumber).trim();
    if (data.notes !== undefined && data.notes !== null) data.notes = String(data.notes).trim();
    const lease = await prisma.lease.update({
      where: { id: req.params.id },
      data,
      include: leaseInclude,
    }).catch(notFoundUpdate);
    if (!lease) return res.status(404).json({ success: false, message: "Lease not found" });
    return res.json({
      success: true,
      message: "Lease updated successfully",
      data: serializePrismaRecord(lease),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteLease = async (req, res, next) => {
  try {
    const lease = await prisma.lease.delete({ where: { id: req.params.id } }).catch(notFoundUpdate);
    if (!lease) return res.status(404).json({ success: false, message: "Lease not found" });
    return res.json({ success: true, message: "Lease deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const createRentPayment = async (req, res, next) => {
  try {
    const {
      tenant: tenantId,
      lease: leaseId,
      property: propertyId,
      unitNumber,
      amount,
      paymentMethod,
      reference,
      period,
    } = req.body;
    if (!tenantId || !leaseId || !propertyId || !unitNumber || amount === undefined ||
        !paymentMethod || !reference || !period) {
      return res.status(400).json({
        success: false,
        message: "Tenant, lease, property, unit, amount, payment method, reference and period are required",
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than zero" });
    }
    const [tenant, lease, property] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.lease.findUnique({ where: { id: leaseId } }),
      prisma.property.findUnique({ where: { id: propertyId } }),
    ]);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    if (!lease) return res.status(404).json({ success: false, message: "Lease not found" });
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    const normalizedReference = String(reference).trim();
    const existing = await prisma.rentPayment.findUnique({ where: { reference: normalizedReference } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A payment with this reference already exists",
      });
    }
    const data = prismaData(req.body, rentPaymentDataFields, {
      tenant: "tenantId",
      lease: "leaseId",
      property: "propertyId",
      recordedBy: "recordedById",
    }, ["paymentDate"]);
    data.unitNumber = String(data.unitNumber).trim();
    data.reference = normalizedReference;
    data.period = String(data.period).trim();
    if (data.notes !== undefined && data.notes !== null) data.notes = String(data.notes).trim();
    Object.assign(data, {
      tenantId,
      leaseId,
      propertyId,
      recordedById: req.user?.id,
    });
    const payment = await prisma.rentPayment.create({
      data,
      include: rentPaymentInclude,
    });
    return res.status(201).json({
      success: true,
      message: "Rent payment recorded successfully",
      data: serializePrismaRecord(payment),
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

export const getRentPayments = async (req, res, next) => {
  try {
    const payments = await prisma.rentPayment.findMany({
      include: rentPaymentInclude,
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

export const getRentPaymentById = async (req, res, next) => {
  try {
    const payment = await prisma.rentPayment.findUnique({
      where: { id: req.params.id },
      include: rentPaymentInclude,
    });
    if (!payment) return res.status(404).json({ success: false, message: "Rent payment not found" });
    return res.json({ success: true, data: serializePrismaRecord(payment) });
  } catch (error) {
    return next(error);
  }
};

export const updateRentPayment = async (req, res, next) => {
  try {
    const data = prismaData(req.body, rentPaymentDataFields, {
      tenant: "tenantId",
      lease: "leaseId",
      property: "propertyId",
      recordedBy: "recordedById",
    }, ["paymentDate"]);
    if (data.unitNumber !== undefined) data.unitNumber = String(data.unitNumber).trim();
    if (data.reference !== undefined) data.reference = String(data.reference).trim();
    if (data.period !== undefined) data.period = String(data.period).trim();
    if (data.notes !== undefined && data.notes !== null) data.notes = String(data.notes).trim();
    const payment = await prisma.rentPayment.update({
      where: { id: req.params.id },
      data,
      include: rentPaymentInclude,
    }).catch(notFoundUpdate);
    if (!payment) return res.status(404).json({ success: false, message: "Rent payment not found" });
    return res.json({
      success: true,
      message: "Rent payment updated successfully",
      data: serializePrismaRecord(payment),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteRentPayment = async (req, res, next) => {
  try {
    const payment = await prisma.rentPayment.delete({
      where: { id: req.params.id },
    }).catch(notFoundUpdate);
    if (!payment) return res.status(404).json({ success: false, message: "Rent payment not found" });
    return res.json({ success: true, message: "Rent payment deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getRentalSummary = async (req, res, next) => {
  try {
    const [properties, activeTenants, activeLeases, collected] = await Promise.all([
      prisma.property.count(),
      prisma.tenant.count({ where: { status: "active" } }),
      prisma.lease.count({ where: { status: "active" } }),
      prisma.rentPayment.aggregate({
        where: { status: "confirmed" },
        _sum: { amount: true },
      }),
    ]);
    res.json({
      success: true,
      data: {
        properties,
        activeTenants,
        activeLeases,
        totalRentCollected: Number(collected._sum.amount || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};
