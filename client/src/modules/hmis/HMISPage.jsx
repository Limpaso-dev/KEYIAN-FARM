import {
  Activity,
  ArrowRight,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Pill,
  Stethoscope,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const HMISPage = () => {
  const modules = [
    {
      title: "Patients",
      description:
        "Register and manage patients, farmer-linked records, contacts, and next-of-kin information.",
      icon: Users,
      path: "/hmis/patients",
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Medical Visits",
      description:
        "Manage outpatient visits, complaints, clinical notes, diagnoses, and treatment plans.",
      icon: Stethoscope,
      path: "/hmis/visits",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Laboratory",
      description:
        "Record laboratory investigations, results, reference ranges, and completion status.",
      icon: FlaskConical,
      path: "/hmis/laboratory",
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "Prescriptions",
      description:
        "Create and manage prescriptions, medications, dosage, frequency, and dispensing status.",
      icon: Pill,
      path: "/hmis/prescriptions",
      color: "bg-orange-50 text-orange-600",
    },
  ];

  const quickStats = [
    {
      label: "Patients",
      value: "—",
      icon: Users,
    },
    {
      label: "Today's Visits",
      value: "—",
      icon: Stethoscope,
    },
    {
      label: "Pending Lab",
      value: "—",
      icon: FlaskConical,
    },
    {
      label: "Prescriptions",
      value: "—",
      icon: Pill,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-600">
            <HeartPulse size={18} />
            Medical Centre
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Health Management Information System
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Manage patient registration, clinical visits, laboratory
            investigations, and prescriptions from one integrated
            medical-centre workspace.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                </div>

                <div className="rounded-lg bg-primary-50 p-3 text-primary-600">
                  <Icon size={21} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Modules */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList
            size={20}
            className="text-slate-700"
          />

          <h2 className="text-lg font-semibold text-slate-900">
            Medical Centre Modules
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <Link
                key={module.title}
                to={module.path}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`rounded-xl p-3 ${module.color}`}
                  >
                    <Icon size={24} />
                  </div>

                  <ArrowRight
                    size={20}
                    className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-primary-500"
                  />
                </div>

                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {module.description}
                </p>

                <div className="mt-5 text-sm font-semibold text-primary-600">
                  Open {module.title}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Integration Notice */}
      <div className="rounded-xl border border-primary-100 bg-primary-50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 text-primary-600 shadow-sm">
            <Activity size={20} />
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">
              Integrated Medical Centre
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              HMIS records are connected to the wider Keiyian ERP.
              Patients can be linked to cooperative farmers, while
              future Finance, Inventory, and HR integrations can use
              the appropriate shared ERP records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HMISPage;