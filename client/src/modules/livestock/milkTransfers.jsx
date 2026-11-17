import { PackageCheck } from "lucide-react";
import { number, today } from "../../lib/format";
import { keepSession, sessionField } from "./dairies";
import { MilkLeftNote } from "./MilkOnHand";

const dairyField = { name: "dairy", label: "Dairy", type: "select", options: "dairies", required: true, onSelect: (_, values, meta) => keepSession(values, meta) };

// Before the litres: what was recorded at that milking, and what is left to send.
const milkLeft = { type: "note", render: (values) => <MilkLeftNote values={values} /> };
const litresField = { name: "litres", label: "Litres sent", type: "number", required: true, help: "No more than is left of that milking" };

/** The fields that send milk to MVA (also used by the Send buttons above the list). */
export const sendMilkFields = [
  { name: "date", label: "Date", type: "date", required: true, span: "third" },
  { ...dairyField, span: "third" },
  { ...sessionField, span: "third" },
  milkLeft,
  litresField,
  { name: "notes", label: "Notes", type: "textarea" },
];

// Shared by the Livestock (send) and MVA (receive) screens. Milk is measured in litres.
export const milkTransfers = {
  resource: "milkTransfers",
  endpoint: "/livestock/milk-transfers",
  title: "Milk sent to MVA",
  description: "Livestock sends milk recorded at a milking, in litres, and no more than was recorded; MVA confirms what it received. Only received milk enters MVA stock.",
  singular: "Transfer",
  createLabel: "Send milk to MVA",
  createFields: sendMilkFields,
  createInitial: () => ({ date: today(), session: "morning" }),
  filters: [{ name: "status", label: "Status", options: "transferStatus" }, { name: "dairy", label: "Dairy", options: "dairies" }, { type: "dateRange" }],
  columns: [
    { key: "transferNumber", label: "Transfer" },
    { key: "date", label: "Date", type: "date" },
    { key: "dairy", label: "Dairy", type: "option:dairies" },
    { key: "session", label: "Session", type: "option:milkSessions" },
    { key: "litres", label: "Sent (L)", type: "number" },
    { key: "receivedLitres", label: "Received (L)", type: "number" },
    { key: "status", label: "Status", type: "status:transferStatus" },
    { key: "notes", label: "Notes" },
  ],
  editableWhen: (r) => r.status === "sent",
  deletableWhen: (r) => r.status === "sent",
  // Changing a transfer, the milk it already took counts as still there.
  toForm: (row) => ({ ...row, date: String(row.date).slice(0, 10), litres: String(Number(row.litres)), _sent: { dairy: row.dairy, session: row.session, litres: Number(row.litres) } }),
  editFields: [dairyField, sessionField, milkLeft, litresField, { name: "notes", label: "Notes", type: "textarea" }],
  actions: [{
    key: "receive", label: "Receive", icon: PackageCheck, variant: "primary",
    allowed: (c) => c.can("milkTransfers", "receive"), when: (r) => r.status === "sent",
    path: (r) => `/livestock/milk-transfers/${r.id}/receive`, title: (r) => `Receive ${r.transferNumber} (${number(r.litres)} L sent)`,
    fields: [{ name: "receivedLitres", label: "Litres received", type: "number", required: true }, { name: "notes", label: "Notes (e.g. spillage)", type: "textarea" }],
    initial: (r) => ({ receivedLitres: r.litres }),
    success: () => "Milk received into MVA raw milk stock",
  }],
};
