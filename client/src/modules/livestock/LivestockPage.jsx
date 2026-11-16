import { Baby, Droplets } from "lucide-react";
import { currentSession, sessionField } from "./dairies";
import { MilkToSend } from "./MilkOnHand";
import { milkTransfers as transfers, sendMilkFields } from "./milkTransfers";
import { ActionButton } from "../../components/resource/ActionButton";
import { ModulePage } from "../../components/resource/ModulePage";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { Badge } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { get } from "../../lib/api";
import { daysAgo, inputDate, number, today } from "../../lib/format";
import { refs } from "../../lib/refs";
import { useFetch } from "../../lib/useFetch";

const tag = (a) => (a ? `${a.tagNumber}${a.name ? ` - ${a.name}` : ""}` : "");
const kg = (value) => `${number(value)} kg`;

const isMale = (v) => v.sex === "male";

const animalFields = [
  { name: "tagNumber", label: "Tag number", required: true },
  { name: "name", label: "Name" },
  // A male is not kept in a dairy: choosing Male clears the dairy and closes it.
  { name: "sex", label: "Sex", type: "select", options: "animalSex", required: true, onSelect: (_, v) => (isMale(v) ? { dairy: "" } : {}) },
  {
    name: "dairy", label: "Dairy", type: "select", options: "dairies",
    required: (v) => !isMale(v), readOnly: isMale,
    placeholder: "Not for males",
    help: (v) => (isMale(v) ? "Males are not kept in a dairy" : undefined),
  },
  { name: "breed", label: "Breed" },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "source", label: "Source", type: "select", options: "animalSource" },
  { name: "acquiredDate", label: "Date bought / received", type: "date", help: "When it joined the herd", showIf: (v) => Boolean(v.source) && v.source !== "born_on_farm" },
  { name: "damId", label: "Mother (dam)", type: "select", ref: refs.cows, placeholder: "Not recorded" },
  { name: "sireId", label: "Father (sire)", type: "select", ref: refs.bulls, placeholder: "Not on farm / not recorded" },
  { name: "sireDetails", label: "Sire details", help: "AI bull code or outside bull, if the sire is not on the farm", span: 2 },
  { name: "status", label: "Status", type: "select", options: "animalStatus", onSelect: (_, v) => (v.status && v.status !== "active" && !v.exitDate ? { exitDate: today() } : {}) },
  { name: "exitDate", label: "Date it left the herd", type: "date", required: true, help: "The day it was sold, died or was culled", showIf: (v) => Boolean(v.status) && v.status !== "active" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const animals = {
  resource: "animals",
  endpoint: "/livestock/animals",
  title: "Herd register",
  singular: "Animal",
  createLabel: "Add animal",
  filters: [
    { type: "search", placeholder: "Tag, name, breed" },
    { name: "dairy", label: "Dairy", options: "dairies" },
    { name: "sex", label: "Sex", options: "animalSex" },
    { name: "status", label: "Status", options: "animalStatus" },
  ],
  defaultQuery: { status: "active" },
  columns: [
    { key: "tagNumber", label: "Tag" },
    { key: "name", label: "Name" },
    { key: "dairy", label: "Dairy", render: (r, ctx) => (r.dairy ? ctx.label("dairies", r.dairy) : <span className="text-slate-400">No dairy</span>) },
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
  toForm: (row) => ({ ...row, dateOfBirth: inputDate(row.dateOfBirth), acquiredDate: inputDate(row.acquiredDate), exitDate: inputDate(row.exitDate) }),
};

// Recording a calving: one calf, or twins (a second calf on the same calving).
const twins = (v) => Boolean(v.twins);
const calvingFields = [
  { name: "damId", label: "Mother (dam)", type: "select", ref: refs.cows, required: true },
  { name: "calvingDate", label: "Calving date", type: "date", required: true },
  { name: "sireId", label: "Father (sire) on farm", type: "select", ref: refs.bulls, placeholder: "Not on farm" },
  { name: "sireDetails", label: "Or sire details", placeholder: "AI bull code / outside bull" },
  { name: "calfTagNumber", label: "Calf tag number", required: true },
  { name: "calfSex", label: "Calf sex", type: "select", options: "animalSex", required: true },
  { name: "calfName", label: "Calf name" },
  { name: "calfBreed", label: "Calf breed", help: "Defaults to the mother's breed" },
  { name: "twins", label: "Twins", type: "checkbox", checkboxLabel: "Twins: two calves were born", span: 2 },
  { type: "section", name: "twinSection", label: "Second calf", help: "Registered with the same mother, father, breed and date of birth.", showIf: twins },
  { name: "twinTagNumber", label: "Second calf tag number", required: true, showIf: twins },
  { name: "twinSex", label: "Second calf sex", type: "select", options: "animalSex", required: true, showIf: twins },
  { name: "twinName", label: "Second calf name", showIf: twins },
  { name: "notes", label: "Notes", type: "textarea" },
];

const lactations = {
  resource: "lactations",
  endpoint: "/livestock/lactations",
  title: "Calvings and lactations",
  description: "Recording a calving registers the calf (or twins) with its mother and father, and starts the mother's next lactation. A heifer calf joins her mother's dairy; a bull calf is not kept in a dairy.",
  singular: "Lactation",
  filters: [{ name: "status", label: "Status", options: "lactationStatus" }, { type: "dateRange" }],
  columns: [
    { key: "animal", label: "Cow", render: (r) => tag(r.animal) },
    { key: "lactationNumber", label: "Lactation no.", type: "number" },
    { key: "calvingDate", label: "Calved", type: "date" },
    {
      key: "calf", label: "Calf",
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{[r.calf, r.twinCalf].filter(Boolean).map((c) => c.tagNumber).join(" and ")}</span>
          {r.twinCalfId && <Badge tone="blue">Twins</Badge>}
        </span>
      ),
    },
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
      fields={calvingFields}
      initial={{ calvingDate: today(), twins: false }}
      toPayload={(v) => (v.twins ? v : { ...v, twinTagNumber: undefined, twinSex: undefined, twinName: undefined })} />
  ),
};

const vaccinations = {
  resource: "vaccinations",
  endpoint: "/livestock/vaccinations",
  title: "Vaccinations",
  singular: "Vaccination",
  createLabel: "Record vaccination",
  filters: [{ name: "vaccine", label: "Vaccine", options: "vaccines" }, { type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "animal", label: "Animal", render: (r) => tag(r.animal) },
    { key: "vaccine", label: "Vaccine", type: "option:vaccines" },
    { key: "dose", label: "Dose" },
    { key: "administeredBy", label: "Given by" },
    { key: "nextDueDate", label: "Next due", type: "date" },
  ],
  createFields: [
    { name: "animalId", label: "Animal", type: "select", ref: refs.animals, required: true, span: 2 },
    { name: "vaccine", label: "Vaccine", type: "select", options: "vaccines", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "dose", label: "Dose" },
    { name: "administeredBy", label: "Given by" },
    { name: "nextDueDate", label: "Next due", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today() }),
  toForm: (row) => ({ ...row, date: inputDate(row.date), nextDueDate: inputDate(row.nextDueDate) }),
};

// A disease case names the disease from the list (Other: written in the details);
// a treatment names the disease or describes itself; checks, deworming and dipping say what was done.
const namesDisease = (v) => ["disease", "treatment"].includes(v.recordType);
const health = {
  resource: "healthRecords",
  endpoint: "/livestock/health-records",
  title: "Disease management and herd health",
  description: "Leave the animal empty for herd-wide events such as dipping or a herd check.",
  singular: "Health record",
  createLabel: "Add record",
  filters: [
    { name: "recordType", label: "Type", options: "healthRecordTypes" },
    { name: "disease", label: "Disease", options: "diseases" },
    { name: "outcome", label: "Outcome", options: "healthOutcomes" },
    { type: "dateRange" },
  ],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "animal", label: "Animal", render: (r) => tag(r.animal) || "Whole herd" },
    { key: "recordType", label: "Type", type: "option:healthRecordTypes" },
    { key: "disease", label: "Disease", type: "option:diseases" },
    { key: "condition", label: "Details" },
    { key: "treatment", label: "Treatment" },
    { key: "vet", label: "Vet" },
    { key: "cost", label: "Cost", type: "money" },
    { key: "outcome", label: "Outcome", type: "status:healthOutcomes" },
  ],
  createFields: [
    { name: "recordType", label: "Type", type: "select", options: "healthRecordTypes", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "animalId", label: "Animal", type: "select", ref: refs.animals, placeholder: "Whole herd", span: 2 },
    { name: "disease", label: "Type of disease", type: "select", options: "diseases", required: (v) => v.recordType === "disease", showIf: namesDisease },
    { name: "condition", label: "Details", help: "For Other, name the disease here", required: (v) => v.disease === "other" || (v.recordType === "treatment" && !v.disease), showIf: namesDisease },
    { name: "condition", label: "What was done or checked", required: true, span: 2, showIf: (v) => !namesDisease(v) },
    { name: "treatment", label: "Treatment given", type: "textarea" },
    { name: "vet", label: "Vet / officer" },
    { name: "cost", label: "Cost (KES)", type: "number" },
    { name: "outcome", label: "Outcome", type: "select", options: "healthOutcomes" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  createInitial: () => ({ date: today(), recordType: "disease", outcome: "under_treatment" }),
  toForm: (row) => ({ ...row, date: inputDate(row.date) }),
};

// Bulk milk entry: kilograms for each cow at the chosen dairy, for one session.
const CALF_DAYS = 365;
const milkingCows = (cows, dairy) => (cows || [])
  .filter((c) => c.dairy === dairy && !(c.dateOfBirth && (Date.now() - new Date(c.dateOfBirth)) / 86400000 < CALF_DAYS))
  .map((c) => ({ animalId: c.id, cow: tag(c), lactation: c.lactationCount, kg: "" }));

const milkEntryFields = [
  { name: "date", label: "Date", type: "date", required: true, span: "third" },
  {
    name: "dairy", label: "Dairy", type: "select", options: "dairies", required: true, span: "third",
    onSelect: (_, v, meta) => ({ session: currentSession(meta, v.dairy), records: milkingCows(v._cows, v.dairy) }),
  },
  { ...sessionField, span: "third" },
  {
    name: "records", label: "Kilograms per cow", type: "items", fixedRows: true, help: "The dairy's cows. Leave a cow blank if she was not milked.",
    columns: [
      { name: "cow", label: "Cow", type: "display" },
      { name: "lactation", label: "Lactations", type: "display", width: 90 },
      { name: "kg", label: "Kg", type: "number", width: 140 },
    ],
    total: (row) => row.kg,
    formatTotal: kg,
  },
];

const MilkTotals = () => {
  const { label } = useAuth();
  const { data } = useFetch("/livestock/milk-records/daily", { from: daysAgo(6), to: today() });
  const rows = data || [];
  const todayRows = rows.filter((r) => String(r.date).slice(0, 10) === today());
  const total = todayRows.reduce((s, r) => s + r.kg, 0);
  const sent = todayRows.reduce((s, r) => s + r.sentToMva, 0);
  const dairies = [...new Set(todayRows.map((r) => r.dairy))].sort();
  const perDairy = dairies.map((d) => `${label("dairies", d)} ${kg(todayRows.filter((r) => r.dairy === d).reduce((s, r) => s + r.kg, 0))}`).join(" · ");
  return (
    <KeyFigures
      items={[
        { label: "Milk today", value: kg(total), hint: perDairy || undefined },
        { label: "Sent to MVA today", value: kg(sent) },
        { label: "Not yet sent", value: kg(total - sent), tone: total - sent > 0 ? "warn" : undefined },
        { label: "Last 7 days", value: kg(rows.reduce((s, r) => s + r.kg, 0)) },
      ]}
    />
  );
};

const milkRecords = {
  resource: "milkRecords",
  endpoint: "/livestock/milk-records",
  title: "Milk records",
  description: "Milk is weighed in kilograms. Dairy A milks in the morning and evening; Dairy C also at midday.",
  singular: "Milk record",
  defaultQuery: { from: today(), to: today() },
  filters: [{ name: "dairy", label: "Dairy", options: "dairies" }, { name: "session", label: "Session", options: "milkSessions" }, { type: "dateRange" }],
  columns: [
    { key: "date", label: "Date", type: "date" },
    { key: "dairy", label: "Dairy", type: "option:dairies" },
    { key: "session", label: "Session", type: "option:milkSessions" },
    { key: "animal", label: "Cow", render: (r) => tag(r.animal) },
    { key: "kg", label: "Kg", type: "number" },
  ],
  editFields: [{ name: "kg", label: "Kg", type: "number", required: true }],
  footer: (rows) => rows.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-right text-sm">Total: <strong>{kg(rows.reduce((s, r) => s + Number(r.kg), 0))}</strong></div>,
  toolbar: (ctx) => ctx.can("milkRecords", "write") && (
    <ActionButton label="Record milking" icon={Droplets} variant="primary" path="/livestock/milk-records" modalSize="lg" onDone={(r) => ctx.notify(r?.message)}
      fields={milkEntryFields}
      initial={async () => {
        const cows = await get("/livestock/animals", { status: "active", sex: "female" });
        // With every cow at one dairy, start there.
        const held = [...new Set(cows.map((c) => c.dairy))];
        const dairy = held.length === 1 ? held[0] : "";
        return { date: today(), dairy, session: dairy ? currentSession(ctx.meta, dairy) : "", _cows: cows, records: milkingCows(cows, dairy) };
      }}
      toPayload={(v) => ({ date: v.date, dairy: v.dairy, session: v.session, records: v.records.filter((r) => r.kg !== "" && Number(r.kg) > 0).map((r) => ({ animalId: r.animalId, kg: r.kg })) })} />
  ),
};

const LivestockPage = () => (
  <ModulePage
    sections={{
      herd: () => <ResourcePage config={animals} />,
      lactations: () => <ResourcePage config={lactations} />,
      vaccinations: () => <ResourcePage config={vaccinations} />,
      health: () => <ResourcePage config={health} />,
      milk: () => <ResourcePage config={milkRecords} header={() => <MilkTotals />} />,
      transfers: () => <ResourcePage config={transfers} header={(ctx) => <MilkToSend ctx={ctx} sendFields={sendMilkFields} />} />,
    }}
  />
);

export default LivestockPage;
