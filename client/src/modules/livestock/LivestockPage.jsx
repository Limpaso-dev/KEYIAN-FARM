import { Baby, Droplets } from "lucide-react";
import { milkTransfers as transfers } from "./milkTransfers";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { Card } from "../../components/ui/ui";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { get } from "../../lib/api";
import { daysAgo, inputDate, nairobiHour, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";

const tag = (a) => (a ? `${a.tagNumber}${a.name ? ` - ${a.name}` : ""}` : "");

const animalFields = [
  { name: "tagNumber", label: "Tag number", required: true },
  { name: "name", label: "Name" },
  { name: "sex", label: "Sex", type: "select", options: "animalSex", required: true },
  { name: "breed", label: "Breed" },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "source", label: "Source", type: "select", options: "animalSource" },
  { name: "damId", label: "Mother (dam)", type: "select", ref: refs.cows, placeholder: "Not recorded" },
  { name: "sireId", label: "Father (sire)", type: "select", ref: refs.bulls, placeholder: "Not on farm / not recorded" },
  { name: "sireDetails", label: "Sire details", help: "AI bull code or outside bull, if the sire is not on the farm", span: 2 },
  { name: "status", label: "Status", type: "select", options: "animalStatus" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const animals = {
  resource: "animals",
  endpoint: "/livestock/animals",
  title: "Herd register",
  singular: "Animal",
  createLabel: "Add animal",
  filters: [{ type: "search", placeholder: "Tag, name, breed" }, { name: "sex", label: "Sex", options: "animalSex" }, { name: "status", label: "Status", options: "animalStatus" }],
  defaultQuery: { status: "active" },
  columns: [
    { key: "tagNumber", label: "Tag" },
    { key: "name", label: "Name" },
    { key: "sex", label: "Sex", type: "option:animalSex" },
    { key: "breed", label: "Breed" },
    { key: "dateOfBirth", label: "Born", type: "date" },
    { key: "dam", label: "Mother", render: (r) => tag(r.dam) },
    { key: "sire", label: "Father", render: (r) => tag(r.sire) || r.sireDetails || "" },
    { key: "lactationCount", label: "Lactations", type: "number" },
    { key: "status", label: "Status", type: "status:animalStatus" },
  ],
  createFields: animalFields,
  createInitial: () => ({ source: "born_on_farm", status: "active" }),
  toForm: (row) => ({ ...row, dateOfBirth: inputDate(row.dateOfBirth) }),
};

const lactations = {
  resource: "lactations",
  endpoint: "/livestock/lactations",
  title: "Calvings and lactations",
  description: "Recording a calving registers the calf with its mother and father and starts the mother's next lactation.",
  singular: "Lactation",
  filters: [{ name: "status", label: "Status", options: "lactationStatus" }, { type: "dateRange" }],
  columns: [
    { key: "animal", label: "Cow", render: (r) => tag(r.animal) },
    { key: "lactationNumber", label: "Lactation no.", type: "number" },
    { key: "calvingDate", label: "Calved", type: "date" },
    { key: "dryOffDate", label: "Dried off", type: "date" },
    { key: "status", label: "Status", type: "status:lactationStatus" },
    { key: "notes", label: "Notes" },
  ],
  editFields: [{ name: "notes", label: "Notes", type: "textarea" }],
  deletable: false,
  actions: [{
    key: "dry", label: "Dry off", allowed: (c) => c.can("lactations", "write"), when: (r) => r.status === "milking",
    path: (r) => `/livestock/lactations/${r.id}/dry-off`, title: (r) => `Dry off ${tag(r.animal)}`,
    fields: [{ name: "dryOffDate", label: "Dry-off date", type: "date", required: true }], initial: () => ({ dryOffDate: today() }),
  }],
  toolbar: (ctx) => ctx.can("lactations", "write") && (
    <ActionButton label="Record calving" icon={Baby} variant="primary" path="/livestock/calvings" onDone={(r) => ctx.notify(r?.message)} modalSize="md"
      fields={[
        { name: "damId", label: "Mother (dam)", type: "select", ref: refs.cows, required: true },
        { name: "calvingDate", label: "Calving date", type: "date", required: true },
        { name: "sireId", label: "Father (sire) on farm", type: "select", ref: refs.bulls, placeholder: "Not on farm" },
        { name: "sireDetails", label: "Or sire details", placeholder: "AI bull code / outside bull" },
        { name: "calfTagNumber", label: "Calf tag number", required: true },
        { name: "calfSex", label: "Calf sex", type: "select", options: "animalSex", required: true },
        { name: "calfName", label: "Calf name" },
        { name: "calfBreed", label: "Calf breed", help: "Defaults to the mother's breed" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      initial={{ calvingDate: today() }} />
  ),
};

const vaccinations = {
  resource: "vaccinations",
  endpoint: "/livestock/vaccinations",
  title: "Vaccinations",
  singular: "Vaccination",
  createLabel: "Record vaccination",
  filters: [{ type: "search", placeholder: "Vaccine" }, { type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "animal", label: "Animal", render: (r) => tag(r.animal) },
    { key: "vaccine", label: "Vaccine" },
    { key: "dose", label: "Dose" },
    { key: "administeredBy", label: "Given by" },
    { key: "nextDueDate", label: "Next due", type: "date" },
  ],
  createFields: [
    { name: "animalId", label: "Animal", type: "select", ref: refs.animals, required: true, span: 2 },
    { name: "vaccine", label: "Vaccine", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "dose", label: "Dose" },
    { name: "administeredBy", label: "Given by" },
    { name: "nextDueDate", label: "Next due", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today() }),
  toForm: (row) => ({ ...row, date: inputDate(row.date), nextDueDate: inputDate(row.nextDueDate) }),
};

const health = {
  resource: "healthRecords",
  endpoint: "/livestock/health-records",
  title: "Disease management and herd health",
  description: "Leave the animal empty for herd-wide events such as dipping or a herd check.",
  singular: "Health record",
  createLabel: "Add record",
  filters: [{ name: "recordType", label: "Type", options: "healthRecordTypes" }, { name: "outcome", label: "Outcome", options: "healthOutcomes" }, { type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "animal", label: "Animal", render: (r) => tag(r.animal) || "Whole herd" },
    { key: "recordType", label: "Type", type: "option:healthRecordTypes" },
    { key: "condition", label: "Condition / disease" },
    { key: "treatment", label: "Treatment" },
    { key: "vet", label: "Vet" },
    { key: "cost", label: "Cost", type: "money" },
    { key: "outcome", label: "Outcome", type: "status:healthOutcomes" },
  ],
  createFields: [
    { name: "recordType", label: "Type", type: "select", options: "healthRecordTypes", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "animalId", label: "Animal", type: "select", ref: refs.animals, placeholder: "Whole herd", span: 2 },
    { name: "condition", label: "Condition / disease / check", required: true, span: 2 },
    { name: "treatment", label: "Treatment given", type: "textarea" },
    { name: "vet", label: "Vet / officer" },
    { name: "cost", label: "Cost (KES)", type: "number" },
    { name: "outcome", label: "Outcome", type: "select", options: "healthOutcomes" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), recordType: "disease", outcome: "under_treatment" }),
  toForm: (row) => ({ ...row, date: inputDate(row.date) }),
};

// Bulk milk entry: one line per milking cow for a session.
const milkEntryFields = [
  { name: "date", label: "Date", type: "date", required: true },
  { name: "session", label: "Session", type: "select", options: "milkSessions", required: true },
  {
    name: "records", label: "Litres per cow", type: "items", fixedRows: true,
    columns: [
      { name: "cow", label: "Cow", type: "display" },
      { name: "lactation", label: "Lactations", type: "display", width: 90 },
      { name: "litres", label: "Litres", type: "number", width: 140 },
    ],
    total: (row) => row.litres,
    formatTotal: (t) => `${number(t)} L`,
  },
];

const MilkTotals = () => {
  const { data } = useFetch("/livestock/milk-records/daily", { from: daysAgo(6), to: today() });
  const rows = data || [];
  const todayRows = rows.filter((r) => String(r.date).slice(0, 10) === today());
  const litres = todayRows.reduce((s, r) => s + r.litres, 0);
  const sent = todayRows.reduce((s, r) => s + r.sentToMva, 0);
  return (
    <Card className="overflow-hidden">
      <KeyFigures
        bare
        items={[
          { label: "Milk today", value: `${number(litres)} L` },
          { label: "Sent to MVA today", value: `${number(sent)} L` },
          { label: "Not yet sent", value: `${number(litres - sent)} L`, tone: litres - sent > 0 ? "warn" : undefined },
          { label: "Last 7 days", value: `${number(rows.reduce((s, r) => s + r.litres, 0))} L` },
        ]}
      />
    </Card>
  );
};

const milkRecords = {
  resource: "milkRecords",
  endpoint: "/livestock/milk-records",
  title: "Milk records",
  singular: "Milk record",
  defaultQuery: { from: today(), to: today() },
  filters: [{ name: "session", label: "Session", options: "milkSessions" }, { type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "session", label: "Session", type: "option:milkSessions" },
    { key: "animal", label: "Cow", render: (r) => tag(r.animal) },
    { key: "litres", label: "Litres", type: "number" },
  ],
  editFields: [{ name: "litres", label: "Litres", type: "number", required: true }],
  footer: (rows) => rows.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-right text-sm">Total: <strong>{number(rows.reduce((s, r) => s + r.litres, 0))} L</strong></div>,
  toolbar: (ctx) => ctx.can("milkRecords", "write") && (
    <ActionButton label="Record milking" icon={Droplets} variant="primary" path="/livestock/milk-records" modalSize="lg" onDone={(r) => ctx.notify(r?.message)}
      fields={milkEntryFields}
      initial={async () => {
        const cows = await get("/livestock/animals", { status: "active", sex: "female" });
        return {
          date: today(),
          session: nairobiHour() < 11 ? "morning" : nairobiHour() < 15 ? "midday" : "evening",
          records: cows.map((c) => ({ animalId: c.id, cow: tag(c), lactation: c.lactationCount, litres: "" })),
        };
      }}
      toPayload={(v) => ({ date: v.date, session: v.session, records: v.records.filter((r) => r.litres !== "" && Number(r.litres) > 0).map((r) => ({ animalId: r.animalId, litres: r.litres })) })} />
  ),
};

const LivestockPage = () => (
  <ModulePage
    title="Livestock"
    description="Herd register, calvings and lactations, vaccinations, disease and herd health, milk records and milk sent to MVA."
    tabs={[
      { key: "herd", label: "Herd", show: (c) => c.can("animals"), render: () => <ResourcePage config={animals} /> },
      { key: "lactations", label: "Calvings & lactations", show: (c) => c.can("lactations"), render: () => <ResourcePage config={lactations} /> },
      { key: "vaccinations", label: "Vaccinations", show: (c) => c.can("vaccinations"), render: () => <ResourcePage config={vaccinations} /> },
      { key: "health", label: "Health", show: (c) => c.can("healthRecords"), render: () => <ResourcePage config={health} /> },
      { key: "milk", label: "Milk records", show: (c) => c.can("milkRecords"), render: () => <ResourcePage config={milkRecords} header={() => <MilkTotals />} /> },
      { key: "transfers", label: "To MVA", show: (c) => c.can("milkTransfers"), render: () => <ResourcePage config={transfers} /> },
    ]}
  />
);

export default LivestockPage;
