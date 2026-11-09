import { PackageCheck } from "lucide-react";
import { number, today } from "../../lib/format";

// Shared by the Livestock (send) and MVA (receive) screens.
export const milkTransfers = {
  resource: "milkTransfers",
  endpoint: "/livestock/milk-transfers",
  title: "Milk sent to MVA",
  description: "Livestock records what it sends; MVA confirms what it received. Only received milk enters MVA stock.",
  singular: "Transfer",
  createLabel: "Send milk to MVA",
  createFields: [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "session", label: "Session", type: "select", options: "milkSessions", required: true },
    { name: "dairy", label: "Dairy", type: "select", options: "dairies", required: true },
    { name: "litres", label: "Litres sent", type: "number", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), session: "morning" }),
  filters: [{ name: "status", label: "Status", options: "transferStatus" }, { name: "dairy", label: "Dairy", options: "dairies" }, { type: "dateRange" }],
  columns: [
    { key: "transferNumber", label: "Transfer" },
    { key: "date", label: "Date", type: "date" },
    { key: "session", label: "Session", type: "option:milkSessions" },
    { key: "dairy", label: "Dairy", type: "option:dairies" },
    { key: "litres", label: "Sent (L)", type: "number" },
    { key: "receivedLitres", label: "Received (L)", type: "number" },
    { key: "status", label: "Status", type: "status:transferStatus" },
    { key: "notes", label: "Notes" },
  ],
  editableWhen: (r) => r.status === "sent",
  deletableWhen: (r) => r.status === "sent",
  editFields: [{ name: "dairy", label: "Dairy", type: "select", options: "dairies", required: true }, { name: "litres", label: "Litres sent", type: "number", required: true }, { name: "notes", label: "Notes", type: "textarea" }],
  actions: [{
    key: "receive", label: "Receive", icon: PackageCheck, variant: "primary",
    allowed: (c) => c.can("milkTransfers", "receive"), when: (r) => r.status === "sent",
    path: (r) => `/livestock/milk-transfers/${r.id}/receive`, title: (r) => `Receive ${r.transferNumber} (${number(r.litres)} L sent)`,
    fields: [{ name: "receivedLitres", label: "Litres received", type: "number", required: true }, { name: "notes", label: "Notes (e.g. spillage)", type: "textarea" }],
    initial: (r) => ({ receivedLitres: r.litres }),
    success: () => "Milk received into MVA raw milk stock",
  }],
};
