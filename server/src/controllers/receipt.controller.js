import { randomInt } from "node:crypto";
import prisma from "../config/prisma.js";
import { serializePrismaRecord } from "../utils/prismaRecords.js";

const receiptInclude = {
  purchaseOrder: { select: { id: true, poNumber: true, department: true } },
  supplier: { select: { id: true, name: true, supplierCode: true } },
  receivedBy: { select: { id: true, name: true } },
  releasedBy: { select: { id: true, name: true } },
  items: {
    include: {
      inventoryItem: { select: { id: true, name: true, itemCode: true, unit: true } },
    },
    orderBy: { poItemIndex: "asc" },
  },
};

const getPoItemIndex = (line, orderItems) => {
  if (Number.isInteger(line.poItemIndex)) return line.poItemIndex;
  return orderItems.findIndex((item) => item.description === line.description);
};

export const listGoodsReceipts = async (req, res, next) => {
  try {
    const receipts = await prisma.goodsReceipt.findMany({
      include: receiptInclude,
      orderBy: { receivedAt: "desc" },
    });
    res.json({
      success: true,
      count: receipts.length,
      data: serializePrismaRecord(receipts),
    });
  } catch (error) {
    next(error);
  }
};

export const receivePurchaseOrder = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.purchaseOrder.findUnique({
        where: { id: req.params.orderId },
        include: { items: true },
      });
      if (!order) return { status: 404, message: "Purchase order not found" };
      if (!["ordered", "partially_received"].includes(order.status)) {
        return {
          status: 409,
          message: "The purchase order must be approved and placed with the supplier before receiving",
        };
      }
      if (!Array.isArray(req.body.items) || req.body.items.length !== order.items.length) {
        return {
          status: 400,
          message: "Provide receiving quantities for every purchase order line",
        };
      }

      const previousReceipts = await transaction.goodsReceipt.findMany({
        where: { purchaseOrderId: order.id },
        include: { items: true },
      });
      const receivedSoFar = order.items.map((_, index) =>
        previousReceipts.reduce((sum, receipt) => {
          const line = receipt.items.find((item) => getPoItemIndex(item, order.items) === index);
          return sum + Number(line?.receivedQuantity || 0);
        }, 0));

      const items = [];
      for (let index = 0; index < order.items.length; index += 1) {
        const submitted = req.body.items[index];
        const receivedQuantity = Number(submitted.receivedQuantity);
        const acceptedQuantity = Number(submitted.acceptedQuantity);
        const damagedQuantity = Number(submitted.damagedQuantity || 0);
        const remaining = Number(order.items[index].quantity) - receivedSoFar[index];
        if (
          ![receivedQuantity, acceptedQuantity, damagedQuantity].every(Number.isFinite) ||
          receivedQuantity < 0 ||
          acceptedQuantity < 0 ||
          damagedQuantity < 0 ||
          Math.abs(receivedQuantity - acceptedQuantity - damagedQuantity) > 0.0001 ||
          receivedQuantity > remaining
        ) {
          return {
            status: 400,
            message: `Invalid or over-received quantity for ${order.items[index].description}. Remaining to receive: ${remaining}`,
          };
        }
        items.push({
          poItemIndex: index,
          description: order.items[index].description,
          orderedQuantity: Number(order.items[index].quantity),
          receivedQuantity,
          acceptedQuantity,
          damagedQuantity,
        });
      }

      const receipt = await transaction.goodsReceipt.create({
        data: {
          receiptNumber: `GRN-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
          purchaseOrderId: order.id,
          supplierId: order.supplierId,
          receivedById: req.user.id,
          notes: String(req.body.notes || "").trim(),
          items: { create: items },
        },
        include: receiptInclude,
      });
      const acceptedTotals = order.items.map((_, index) =>
        previousReceipts.reduce((sum, oldReceipt) => {
          const line = oldReceipt.items.find((item) => getPoItemIndex(item, order.items) === index);
          return sum + Number(line?.acceptedQuantity || 0);
        }, 0) + items[index].acceptedQuantity);
      const allReceived = acceptedTotals.every((quantity, index) =>
        quantity >= Number(order.items[index].quantity));
      await transaction.purchaseOrder.update({
        where: { id: order.id },
        data: {
          receivedQuantities: acceptedTotals.map((quantity, index) => ({
            description: order.items[index].description,
            acceptedQuantity: quantity,
          })),
          status: allReceived ? "received" : "partially_received",
        },
      });
      return { receipt };
    }, { isolationLevel: "Serializable" });

    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.status(201).json({
      success: true,
      message: "Delivery checked against the purchase order and sent to stores for stock entry",
      data: serializePrismaRecord(result.receipt),
    });
  } catch (error) {
    return next(error);
  }
};

export const releaseReceiptToStores = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const receipt = await transaction.goodsReceipt.findUnique({
        where: { id: req.params.id },
        include: { items: true, purchaseOrder: { include: { items: true } } },
      });
      if (!receipt) return { status: 404, message: "Goods receipt not found" };
      if (receipt.status !== "pending_store") {
        return { status: 409, message: "This receipt has already been released to stores" };
      }
      if (!Array.isArray(req.body.items) || req.body.items.length !== receipt.items.length) {
        return { status: 400, message: "Select a stock item for each accepted receipt line" };
      }

      const selectedInventory = [];
      for (let index = 0; index < receipt.items.length; index += 1) {
        const line = receipt.items[index];
        if (!Number(line.acceptedQuantity)) continue;
        const inventoryId = req.body.items[index]?.inventoryItem;
        const inventoryItem = inventoryId
          ? await transaction.inventory.findUnique({ where: { id: inventoryId } })
          : null;
        if (!inventoryItem) {
          return { status: 400, message: `Select a valid inventory item for ${line.description}` };
        }
        const poItemIndex = getPoItemIndex(line, receipt.purchaseOrder.items);
        const orderItem = receipt.purchaseOrder.items[poItemIndex];
        if (!orderItem) {
          throw new Error(`Receipt line "${line.description}" does not match a purchase order line`);
        }
        selectedInventory.push({ inventoryItem, line, orderItem });
      }

      for (const { inventoryItem, line, orderItem } of selectedInventory) {
        await transaction.inventory.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: { increment: Number(line.acceptedQuantity) },
            unitCost: Number(orderItem.unitPrice),
          },
        });
      }
      const updatedReceipt = await transaction.goodsReceipt.update({
        where: { id: receipt.id },
        data: {
          status: "released_to_stores",
          releasedById: req.user.id,
          releasedAt: new Date(),
          items: {
            update: selectedInventory.map(({ line, inventoryItem }) => ({
              where: { id: line.id },
              data: { inventoryItemId: inventoryItem.id },
            })),
          },
        },
        include: receiptInclude,
      });
      return { receipt: updatedReceipt };
    }, { isolationLevel: "Serializable" });

    if (result.status) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      message: "Accepted goods released and inventory updated by stores",
      data: serializePrismaRecord(result.receipt),
    });
  } catch (error) {
    return next(error);
  }
};
