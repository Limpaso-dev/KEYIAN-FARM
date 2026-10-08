import { ChevronDown, UserRound } from "lucide-react";

const PatientProfilePanel = ({ patient }) => {
  if (!patient) return null;

  const name = [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Patient";
  const initials = [patient.firstName?.[0], patient.lastName?.[0]].filter(Boolean).join("").toUpperCase();
  const details = [
    ["National ID / Birth Certificate", patient.nationalId],
    ["Phone", patient.phone],
    ["Sex", patient.sex],
    ["Date of birth", patient.dateOfBirth && new Date(patient.dateOfBirth).toLocaleDateString()],
    ["Estimated age", patient.estimatedAge != null && `${patient.estimatedAge} years`],
    ["Address", patient.address],
    ["Patient status", patient.status?.replaceAll("_", " ")],
  ].filter(([, value]) => value);

  return (
    <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
            {initials || <UserRound size={18} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
            <span className="block text-xs text-slate-500">Patient No: {patient.patientNumber || "—"}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-primary-700">
          <span>Patient profile</span>
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      {details.length > 0 && <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-200 bg-slate-50/70 px-4 py-4 sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
        </div>)}
      </div>}
    </details>
  );
};

export default PatientProfilePanel;
