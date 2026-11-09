import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FileSignature, Pencil, Trash2, UserRound } from "lucide-react";
import { FormModal } from "../../components/forms/Form";
import { ReportTable } from "../../components/reports/ReportDocument";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { Alert, Badge, Button, Modal, PageHeader, Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { del, errorMessage, post, put } from "../../lib/api";
import { date, fullName, inputDate, money, today } from "../../lib/format";
import { showError, toast } from "../../lib/toast";
import { clearFetchCache, useFetch } from "../../lib/useFetch";
import { Details } from "./Details";
import { advertPath } from "./establishment";
import { contractInputs, employeeFields } from "./staff";

const CURRENT = ["active", "suspended"];
const NONE = "None on record";

const wholeMonths = (from, to) => {
  const a = new Date(from);
  const b = new Date(to);
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
  return Math.max(months, 0);
};

const serviceText = (months) => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years && `${years} year${years === 1 ? "" : "s"}`, (rest || !years) && `${rest} month${rest === 1 ? "" : "s"}`].filter(Boolean).join(" ");
};

/** Everything on record about one staff member. */
const StaffProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { can, label } = auth;
  const { data: staff, loading, error, reload } = useFetch(`/hr/employees/${id}/profile`);
  const [dialog, setDialog] = useState(null); // edit | contract | correct | remove
  const [removing, setRemoving] = useState(false);

  if (loading && !staff) return <Spinner />;
  if (!staff) return <Alert tone="error">{error || "This staff member could not be found."}</Alert>;

  const name = fullName(staff);
  const contract = staff.contracts.find((c) => c.status === "active");
  const canEdit = can("employees", "write");
  const canContract = can("contracts", "write") && CURRENT.includes(staff.status);
  const until = staff.termination?.terminationDate || today();

  const finish = (message) => {
    clearFetchCache();
    setDialog(null);
    reload();
    toast(message);
  };

  const fields = employeeFields(auth, staff);
  const editValues = () => ({
    ...Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name, staff[f.name]])),
    dateOfBirth: inputDate(staff.dateOfBirth),
    dateHired: inputDate(staff.dateHired),
  });

  const remove = async () => {
    setRemoving(true);
    try {
      await del(`/hr/employees/${id}`);
      clearFetchCache();
      toast(`${name} deleted`);
      navigate("/hr?tab=staff");
    } catch (err) {
      setDialog(null);
      showError(errorMessage(err), "Could not delete");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        icon={UserRound}
        eyebrow="Staff profile"
        title={<span className="inline-flex flex-wrap items-center gap-3">{name}<Badge value={staff.status}>{label("employeeStatus", staff.status)}</Badge></span>}
        description={`${staff.staffNumber} · ${staff.jobTitle} · ${label("departments", staff.department)}`}
        actions={(
          <>
            {canContract && <Button variant="secondary" size="sm" icon={FileSignature} onClick={() => setDialog("contract")}>{contract ? "Renew contract" : "Add contract"}</Button>}
            {canEdit && <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setDialog("edit")}>Edit details</Button>}
            {can("employees", "delete") && <Button variant="ghost" size="sm" icon={Trash2} aria-label="Delete staff member" title="Delete" onClick={() => setDialog("remove")} />}
          </>
        )}
      />

      <KeyFigures
        items={[
          { label: "Basic salary", value: money(staff.basicSalary) },
          { label: "Job group", value: staff.jobGroup || "Not set", tone: staff.jobGroup ? undefined : "warn" },
          { label: "Length of service", value: serviceText(wholeMonths(staff.dateHired, until)), hint: `Hired ${date(staff.dateHired)}` },
          { label: "Current contract", value: contract ? label("contractTypes", contract.contractType) : "None", hint: contract ? (contract.endDate ? `Ends ${date(contract.endDate)}` : "No end date") : undefined, tone: contract || !CURRENT.includes(staff.status) ? undefined : "warn" },
        ]}
      />

      <Details
        title="Personal details"
        items={[
          ["National ID", staff.nationalId],
          ["Gender", label("gender", staff.gender)],
          ["Date of birth", staff.dateOfBirth ? `${date(staff.dateOfBirth)} (age ${Math.floor(wholeMonths(staff.dateOfBirth, today()) / 12)})` : ""],
          ["Phone", staff.phone],
          ["Email", staff.email],
          ["Address", staff.address],
        ]}
      />

      <Details
        title="Employment"
        items={[
          ["Staff number", staff.staffNumber],
          ["Department", label("departments", staff.department)],
          ["Job title", staff.jobTitle],
          ["Job group", staff.jobGroup],
          ["Employment type", label("employmentTypes", staff.employmentType)],
          ["Date hired", date(staff.dateHired)],
          ["Bank", staff.bankName],
          ["Bank account", staff.bankAccount],
          ["KRA PIN", staff.kraPin],
          ["System account", staff.user ? `${staff.user.email}${staff.user.isActive ? "" : " (inactive)"}` : "None"],
          ...(staff.applicant ? [["Recruited through", <Link key="advert" to={advertPath(staff.applicant.advert.id)} className="text-primary-700 hover:underline">{staff.applicant.advert.advertNumber}, interview score {staff.applicant.interviewScore ?? "not recorded"}</Link>]] : []),
          ...(staff.notes ? [["Notes", staff.notes]] : []),
        ]}
      />

      <Details
        title="Next of kin and dependants"
        items={[
          ["Next of kin", staff.nextOfKinName],
          ["Next of kin's National ID", staff.nextOfKinNationalId],
          ["Next of kin's phone", staff.nextOfKinPhone],
          ["Number of dependants", staff.dependants],
        ]}
      />

      <div>
        <ReportTable
          emptyText={NONE}
          section={{
            title: "Contracts",
            columns: [
              { key: "contractNumber", label: "Contract" },
              { key: "type", label: "Type" },
              { key: "startDate", label: "Start", type: "date" },
              { key: "endDate", label: "End", type: "date" },
              { key: "salary", label: "Salary (KES)", type: "money" },
              { key: "status", label: "Status" },
              { key: "terms", label: "Terms" },
            ],
            rows: staff.contracts.map((c) => ({ ...c, type: label("contractTypes", c.contractType), status: label("contractStatus", c.status) })),
          }}
        />
        {canContract && contract && (
          <button type="button" onClick={() => setDialog("correct")} className="mt-2 text-sm font-medium text-primary-700 hover:underline">Correct the current contract</button>
        )}
      </div>

      <ReportTable
        emptyText={NONE}
        section={{
          title: "Salary reviews and promotions",
          columns: [
            { key: "effectiveDate", label: "Effective", type: "date" },
            { key: "type", label: "Type" },
            { key: "previousSalary", label: "Previous (KES)", type: "money" },
            { key: "newSalary", label: "New (KES)", type: "money" },
            { key: "title", label: "Job title" },
            { key: "group", label: "Job group" },
            { key: "reason", label: "Reason" },
          ],
          rows: staff.salaryReviews.map((r) => ({
            ...r,
            type: label("salaryReviewTypes", r.reviewType),
            title: r.previousJobTitle !== r.newJobTitle ? `${r.previousJobTitle} → ${r.newJobTitle}` : r.newJobTitle,
            group: r.previousJobGroup !== r.newJobGroup ? `${r.previousJobGroup || "Not set"} → ${r.newJobGroup}` : r.newJobGroup,
          })),
        }}
      />

      <ReportTable
        emptyText={NONE}
        section={{
          title: "Payroll",
          columns: [
            { key: "period", label: "Month" },
            { key: "basicSalary", label: "Basic (KES)", type: "money" },
            { key: "allowances", label: "Allowances (KES)", type: "money" },
            { key: "deductions", label: "Deductions (KES)", type: "money" },
            { key: "netPay", label: "Net pay (KES)", type: "money" },
            { key: "status", label: "Status" },
            { key: "paidAt", label: "Paid on", type: "date" },
          ],
          rows: staff.payrolls.map((p) => ({ ...p, status: label("payrollStatus", p.status) })),
        }}
      />

      <ReportTable
        emptyText={NONE}
        section={{
          title: "Disciplinary record",
          columns: [
            { key: "caseNumber", label: "Case" },
            { key: "incidentDate", label: "Date", type: "date" },
            { key: "offence", label: "Offence" },
            { key: "action", label: "Action taken" },
            { key: "letter", label: "Letter served" },
            { key: "status", label: "Status" },
          ],
          rows: staff.disciplinaryCases.map((c) => ({
            ...c,
            action: label("disciplinaryActions", c.actionTaken),
            letter: c.letterServed ? `Yes${c.letterDate ? `, ${date(c.letterDate)}` : ""}` : "No",
            status: label("caseStatus", c.status),
          })),
        }}
      />

      {staff.termination && (
        <Details
          title="Termination"
          items={[
            ["Type", label("terminationTypes", staff.termination.terminationType)],
            ["Date", date(staff.termination.terminationDate)],
            ["Reason", staff.termination.reason],
            ["Final dues", money(staff.termination.finalDues)],
            ["Clearance", label("clearanceStatus", staff.termination.clearanceStatus)],
            ...(staff.termination.notes ? [["Notes", staff.termination.notes]] : []),
          ]}
        />
      )}

      {dialog === "edit" && (
        <FormModal
          open
          size="lg"
          icon={Pencil}
          title={`Edit ${name}`}
          fields={fields}
          initial={editValues}
          submitLabel="Save changes"
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await put(`/hr/employees/${id}`, values);
            finish("Staff member updated");
          }}
        />
      )}

      {dialog === "contract" && (
        <FormModal
          open
          icon={FileSignature}
          title={`${contract ? "Renew contract for" : "Add contract for"} ${name}`}
          intro={<p className="text-sm text-slate-600">The salary on this contract will be {money(staff.basicSalary)}, the current basic salary.{contract ? ` Contract ${contract.contractNumber} will be marked as renewed.` : ""}</p>}
          fields={contractInputs("startDate", "endDate", "terms")}
          initial={() => ({ contractType: contract?.contractType || "permanent", startDate: today() })}
          submitLabel={contract ? "Renew contract" : "Add contract"}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await post("/hr/contracts", { ...values, employeeId: id });
            finish("Contract saved");
          }}
        />
      )}

      {dialog === "correct" && contract && (
        <FormModal
          open
          icon={Pencil}
          title={`Correct ${contract.contractNumber}`}
          fields={contractInputs("startDate", "endDate", "terms")}
          initial={() => ({ contractType: contract.contractType, startDate: inputDate(contract.startDate), endDate: inputDate(contract.endDate), terms: contract.terms })}
          submitLabel="Save changes"
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await put(`/hr/contracts/${contract.id}`, values);
            finish("Contract corrected");
          }}
        />
      )}

      <Modal
        open={dialog === "remove"}
        size="sm"
        icon={Trash2}
        tone="danger"
        title={`Delete ${name}?`}
        onClose={() => setDialog(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" loading={removing} onClick={remove}>Delete</Button>
          </>
        )}
      >
        <p className="text-sm leading-relaxed text-slate-600">This removes the staff member and their contracts permanently. It is only for records entered by mistake. If they have left, record a termination instead.</p>
      </Modal>
    </div>
  );
};

export default StaffProfile;
