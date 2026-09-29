import PDFDocument from "pdfkit";

import Farmer from "../models/Farmer.js";
import Sale from "../models/Sale.js";

const parseReportPeriod = (query) => {
  const dateRange = {};
  const isValidDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };

  if (query.from) {
    if (!isValidDate(query.from)) return { error: "Invalid start date" };
    dateRange.$gte = new Date(`${query.from}T00:00:00.000Z`);
  }

  if (query.to) {
    if (!isValidDate(query.to)) return { error: "Invalid end date" };
    const endExclusive = new Date(`${query.to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    dateRange.$lt = endExclusive;
  }

  if (dateRange.$gte && dateRange.$lt && dateRange.$gte >= dateRange.$lt) {
    return { error: "Start date must be on or before end date" };
  }

  return { dateRange };
};

const getFarmerReportData = async (status) => {
  const filter = {};
  if (status && status !== "all") {
    if (!["active", "inactive", "suspended"].includes(status)) {
      return { error: "Invalid farmer status filter" };
    }
    filter.membershipStatus = status;
  }

  const farmers = await Farmer.find(filter)
    .select("membershipNumber firstName lastName phone farmLocation membershipStatus shares")
    .sort({ membershipNumber: 1 })
    .lean();

  return {
    farmers,
    count: farmers.length,
    totalShares: farmers.reduce((sum, farmer) => sum + Number(farmer.shares || 0), 0),
  };
};

const getSalesReportData = async (query) => {
  const period = parseReportPeriod(query);
  if (period.error) return period;

  const filter = { status: { $ne: "cancelled" } };
  if (Object.keys(period.dateRange).length) {
    filter.saleDate = period.dateRange;
  }

  const [sales, aggregates] = await Promise.all([
    Sale.find(filter)
      .select("invoiceNumber saleDate customer totalAmount amountPaid balanceDue status paymentStatus")
      .populate("customer", "name")
      .sort({ saleDate: -1, invoiceNumber: 1 })
      .lean(),
    Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$amountPaid" },
          outstanding: { $sum: "$balanceDue" },
        },
      },
    ]),
  ]);

  const summary = aggregates[0] || {
    count: 0,
    totalSales: 0,
    totalPaid: 0,
    outstanding: 0,
  };

  return {
    from: query.from || null,
    to: query.to || null,
    summary: {
      count: summary.count,
      totalSales: summary.totalSales,
      totalPaid: summary.totalPaid,
      outstanding: summary.outstanding,
    },
    sales,
  };
};

const currency = (amount) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(Number(amount) || 0);

const streamPdf = (res, filename, title, summaryLines, columns, rows) => {
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 36,
    bufferPages: true,
  });
  const pageWidth = document.page.width;
  const margin = document.page.margins.left;
  const columnWidth = (pageWidth - margin - document.page.margins.right) / columns.length;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  document.pipe(res);

  document.fontSize(18).font("Helvetica-Bold").text("KEIYIAN FARMERS COOPERATIVE", margin, 34);
  document.moveDown(0.35);
  document.fontSize(13).text(title);
  document.fontSize(9).font("Helvetica").fillColor("#475569");
  summaryLines.forEach((line) => document.text(line));
  document.fillColor("#0f172a");

  const drawHeader = (top) => {
    let x = margin;
    document.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
    columns.forEach((column) => {
      document.text(column, x, top, { width: columnWidth - 8, height: 22, ellipsis: true });
      x += columnWidth;
    });
    document.moveTo(margin, top + 19).lineTo(pageWidth - margin, top + 19).strokeColor("#94a3b8").stroke();
    document.font("Helvetica").fillColor("#0f172a");
    return top + 25;
  };

  let y = drawHeader(document.y + 10);
  rows.forEach((row) => {
    if (y > document.page.height - document.page.margins.bottom - 24) {
      document.addPage();
      y = drawHeader(document.page.margins.top);
    }
    let x = margin;
    document.fontSize(8);
    row.forEach((value) => {
      document.text(String(value ?? "-"), x, y, { width: columnWidth - 8, height: 22, ellipsis: true });
      x += columnWidth;
    });
    y += 24;
    document.moveTo(margin, y - 3).lineTo(pageWidth - margin, y - 3).strokeColor("#e2e8f0").stroke();
  });

  if (!rows.length) {
    document.fontSize(9).text("No records for the selected filters.", margin, y + 4);
  }

  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.fontSize(8).fillColor("#64748b").text(
      `Generated ${new Date().toLocaleString("en-KE")}  |  Page ${index + 1} of ${range.count}`,
      margin,
      document.page.height - 24,
      { align: "right", width: pageWidth - margin * 2 }
    );
  }

  document.end();
};

export const getFarmersReport = async (req, res, next) => {
  try {
    const report = await getFarmerReportData(req.query.status);
    if (report.error) {
      return res.status(400).json({ success: false, message: report.error });
    }
    return res.json({ success: true, data: report });
  } catch (error) {
    return next(error);
  }
};

export const downloadFarmersReport = async (req, res, next) => {
  try {
    const report = await getFarmerReportData(req.query.status);
    if (report.error) {
      return res.status(400).json({ success: false, message: report.error });
    }
    const rows = report.farmers.map((farmer) => [
      farmer.membershipNumber,
      `${farmer.firstName} ${farmer.lastName}`,
      farmer.phone,
      farmer.farmLocation,
      farmer.shares,
      farmer.membershipStatus,
    ]);

    return streamPdf(
      res,
      "keiyian-farmers-report.pdf",
      "Farmers List",
      [`Farmers: ${report.count}  |  Total shares: ${report.totalShares}`],
      ["Membership No.", "Farmer Name", "Phone", "Farm Location", "Shares", "Status"],
      rows
    );
  } catch (error) {
    return next(error);
  }
};

export const getSalesReport = async (req, res, next) => {
  try {
    const report = await getSalesReportData(req.query);
    if (report.error) {
      return res.status(400).json({ success: false, message: report.error });
    }
    return res.json({ success: true, data: report });
  } catch (error) {
    return next(error);
  }
};

export const downloadSalesReport = async (req, res, next) => {
  try {
    const report = await getSalesReportData(req.query);
    if (report.error) {
      return res.status(400).json({ success: false, message: report.error });
    }
    const periodLabel = report.from || report.to
      ? `${report.from || "Beginning"} to ${report.to || "Today"}`
      : "All dates";
    const rows = report.sales.map((sale) => [
      sale.invoiceNumber,
      new Date(sale.saleDate).toLocaleDateString("en-KE"),
      sale.customer?.name,
      sale.status,
      currency(sale.totalAmount),
      currency(sale.amountPaid),
      currency(sale.balanceDue),
    ]);

    return streamPdf(
      res,
      "keiyian-sales-summary.pdf",
      "Sales Summary",
      [
        `Period: ${periodLabel}`,
        `Transactions: ${report.summary.count}  |  Sales: ${currency(report.summary.totalSales)}  |  Paid: ${currency(report.summary.totalPaid)}  |  Outstanding: ${currency(report.summary.outstanding)}`,
      ],
      ["Invoice", "Date", "Customer", "Status", "Total", "Paid", "Balance"],
      rows
    );
  } catch (error) {
    return next(error);
  }
};