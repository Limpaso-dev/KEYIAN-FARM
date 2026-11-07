import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { del, post, put } from "../../lib/api";
import { date, money, number } from "../../lib/format";
import { clearFetchCache, useFetch } from "../../lib/useFetch";
import { FormModal } from "../forms/Form";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner } from "../ui/ui";

// Column: { key, label, type?: date|money|number|status:<list>|option:<list>|bool, render?(row, ctx), align? }
// Action: { key, label, icon, when?(row, ctx), allowed?(ctx), path(row), method?, fields?, initial?(row),
//           confirm?, submitLabel?, tone?, size?, title?(row) }

const cellValue = (column, row, ctx) => {
  if (column.render) return column.render(row, ctx);
  const value = column.key.split(".").reduce((obj, part) => obj?.[part], row);
  const [type, list] = String(column.type || "").split(":");
  switch (type) {
    case "date": return date(value);
    case "money": return money(value);
    case "number": return number(value);
    case "bool": return value ? "Yes" : "No";
    case "option": return ctx.label(list, value);
    case "status": return value ? <Badge value={value}>{ctx.label(list, value)}</Badge> : "";
    default: return value ?? "";
  }
};

const isNumeric = (column) => ["money", "number"].includes(String(column.type || "").split(":")[0]) || column.align === "right";

export const DataTable = ({ columns, rows, ctx, actions = [], expand, emptyText }) => {
  const [open, setOpen] = useState(null);
  if (!rows.length) return <EmptyState title={emptyText || "No records found"}>Try changing the filters, or add a new record.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {expand && <th className="w-8" />}
            {columns.map((c) => <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 ${isNumeric(c) ? "text-right" : ""}`}>{c.label}</th>)}
            {actions.length > 0 && <th className="px-3 py-2.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const visibleActions = actions.filter((a) => !a.when || a.when(row, ctx));
            const isOpen = open === row.id;
            return (
              <Fragment key={row.id}>
                <tr className="hover:bg-slate-50/70">
                  {expand && (
                    <td className="pl-2">
                      <button type="button" aria-label={isOpen ? "Hide details" : "Show details"} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : row.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                  )}
                  {columns.map((c) => <td key={c.key} className={`px-3 py-2.5 align-top text-slate-700 ${isNumeric(c) ? "whitespace-nowrap text-right tabular-nums" : ""} ${c.className || ""}`}>{cellValue(c, row, ctx)}</td>)}
                  {actions.length > 0 && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        {visibleActions.map((a) => (
                          <Button key={a.key} size="sm" variant={a.variant || "secondary"} icon={a.icon} onClick={() => a.onClick(row)} aria-label={a.ariaLabel?.(row)}>{a.label}</Button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
                {expand && isOpen && (
                  <tr className="bg-slate-50/60"><td colSpan={columns.length + 2} className="px-6 py-4">{expand(row, ctx)}</td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** Filter bar: search, selects and a date range. */
const Filters = ({ filters, query, setQuery }) => {
  const { meta } = useAuth();
  if (!filters?.length) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-3">
      {filters.map((f) => {
        if (f.type === "search") {
          return (
            <div key="search" className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input aria-label="Search" placeholder={f.placeholder || "Search..."} className="pl-9" value={query.search || ""} onChange={(e) => setQuery({ ...query, search: e.target.value })} />
            </div>
          );
        }
        if (f.type === "dateRange") {
          return (
            <div key="dates" className="flex items-end gap-2">
              <label className="text-xs text-slate-500">From<Input type="date" className="mt-1" value={query.from || ""} onChange={(e) => setQuery({ ...query, from: e.target.value })} /></label>
              <label className="text-xs text-slate-500">To<Input type="date" className="mt-1" value={query.to || ""} onChange={(e) => setQuery({ ...query, to: e.target.value })} /></label>
            </div>
          );
        }
        const options = typeof f.options === "string" ? meta?.[f.options] || [] : f.options || [];
        return (
          <label key={f.name} className="min-w-[160px] text-xs text-slate-500">
            {f.label}
            <Select className="mt-1" options={options} placeholder="All" value={query[f.name] || ""} onChange={(e) => setQuery({ ...query, [f.name]: e.target.value })} />
          </label>
        );
      })}
    </div>
  );
};

/**
 * Generic page for one API collection. See modules/* for examples.
 */
export const ResourcePage = ({ config, header }) => {
  const auth = useAuth();
  const [query, setQuery] = useState(config.defaultQuery || {});
  const [debounced, setDebounced] = useState(query);
  const [form, setForm] = useState(null); // { mode, row, action }
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");

  // Debounce typing in the search box.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = Object.fromEntries(Object.entries({ ...config.params, ...debounced }).filter(([, v]) => v !== "" && v != null));
  const { data, loading, error: loadError, reload } = useFetch(config.endpoint, params);
  const rows = config.transform ? config.transform(data || []) : data || [];

  // notify() is used by toolbar buttons: refresh the list and show a message.
  const notify = (message) => {
    clearFetchCache();
    reload();
    setNotice(message || "Saved");
  };
  const ctx = { ...auth, reload, notify };
  const canCreate = config.canCreate ? config.canCreate(ctx) : auth.can(config.resource, "write");
  const canEdit = config.editFields !== false && (config.canEdit ? config.canEdit(ctx) : auth.can(config.resource, "write"));
  const canDelete = config.deletable !== false && (config.canDelete ? config.canDelete(ctx) : auth.can(config.resource, "delete"));

  const done = (message) => {
    clearFetchCache();
    setForm(null);
    setConfirm(null);
    reload();
    if (message) setNotice(message);
  };

  const submitForm = async (values) => {
    const { mode, row, action } = form;
    if (action) {
      const payload = action.toPayload ? action.toPayload(values, row) : values;
      const result = await post(action.path(row), payload);
      done(action.success ? action.success(result.data, row) : `${action.label} saved`);
      return;
    }
    const payload = config.toPayload ? config.toPayload(values, mode) : values;
    if (mode === "create") {
      const result = await post(config.createPath || config.endpoint, payload);
      done(config.created ? config.created(result.data) : `${config.singular || "Record"} added`);
    } else {
      await put(`${config.itemEndpoint || config.endpoint}/${row.id}`, payload);
      done(`${config.singular || "Record"} updated`);
    }
  };

  const runConfirm = async () => {
    setError("");
    try {
      if (confirm.kind === "delete") {
        await del(`${config.itemEndpoint || config.endpoint}/${confirm.row.id}`);
        done(`${config.singular || "Record"} deleted`);
      } else {
        const { action, row } = confirm;
        const result = await post(action.path(row), action.toPayload ? action.toPayload({}, row) : {});
        done(action.success ? action.success(result.data, row) : `${action.label} done`);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "That did not work. Please try again.");
      setConfirm(null);
    }
  };

  const rowActions = [
    ...(config.actions || [])
      .filter((a) => !a.allowed || a.allowed(ctx))
      .map((a) => ({
        ...a,
        onClick: (row) => (a.fields ? setForm({ mode: "action", row, action: a }) : setConfirm({ kind: "action", action: a, row })),
      })),
    ...(canEdit ? [{ key: "edit", label: "", ariaLabel: () => "Edit", icon: Pencil, when: config.editableWhen, onClick: (row) => setForm({ mode: "edit", row }) }] : []),
    ...(canDelete ? [{ key: "delete", label: "", ariaLabel: () => "Delete", icon: Trash2, variant: "ghost", when: config.deletableWhen, onClick: (row) => setConfirm({ kind: "delete", row }) }] : []),
  ];

  const formConfig = (() => {
    if (!form) return null;
    if (form.action) {
      const a = form.action;
      return {
        title: a.title ? a.title(form.row) : a.label,
        fields: typeof a.fields === "function" ? a.fields(form.row, ctx) : a.fields,
        initial: () => (a.initial ? a.initial(form.row, ctx) : {}),
        submitLabel: a.submitLabel || a.label,
        size: a.size,
        intro: a.intro?.(form.row),
        tone: a.tone,
      };
    }
    const create = form.mode === "create";
    const fields = create ? config.createFields : config.editFields || config.createFields;
    return {
      title: create ? config.createLabel || `Add ${config.singular?.toLowerCase() || "record"}` : `Edit ${config.singular?.toLowerCase() || "record"}`,
      fields: typeof fields === "function" ? fields(ctx, form.row) : fields,
      initial: () => (create ? (config.createInitial ? config.createInitial(ctx) : {}) : config.toForm ? config.toForm(form.row) : form.row),
      submitLabel: create ? config.createSubmit || "Save" : "Save changes",
      size: config.formSize,
    };
  })();

  return (
    <div className="space-y-4">
      <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>
      <Alert tone="error" onClose={() => setError("")}>{error}</Alert>
      {header?.(ctx)}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{config.title}</h2>
            {config.description && <p className="text-xs text-slate-500">{config.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={reload} aria-label="Refresh">Refresh</Button>
            {canCreate && config.createFields && <Button size="sm" icon={Plus} onClick={() => setForm({ mode: "create" })}>{config.createLabel || `Add ${config.singular?.toLowerCase() || ""}`}</Button>}
            {config.toolbar?.(ctx)}
          </div>
        </div>
        <Filters filters={config.filters} query={query} setQuery={setQuery} />
        {loadError && <div className="p-4"><Alert tone="error">{loadError}</Alert></div>}
        {loading && !data ? <Spinner /> : (
          <DataTable columns={config.columns} rows={rows} ctx={ctx} actions={rowActions} expand={config.expand} emptyText={config.emptyText} />
        )}
        {config.footer?.(rows, ctx)}
      </Card>

      {formConfig && (
        <FormModal open title={formConfig.title} fields={formConfig.fields} initial={formConfig.initial} onSubmit={submitForm} onClose={() => setForm(null)} submitLabel={formConfig.submitLabel} size={formConfig.size} intro={formConfig.intro} tone={formConfig.tone} />
      )}

      <Modal
        open={Boolean(confirm)}
        size="sm"
        title={confirm?.kind === "delete" ? `Delete this ${config.singular?.toLowerCase() || "record"}?` : confirm?.action?.label}
        onClose={() => setConfirm(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.kind === "delete" ? "danger" : "primary"} onClick={runConfirm}>{confirm?.kind === "delete" ? "Delete" : confirm?.action?.submitLabel || "Confirm"}</Button>
          </>
        )}
      >
        <p className="text-sm text-slate-600">
          {confirm?.kind === "delete" ? "This cannot be undone." : confirm?.action?.confirm?.(confirm.row) || "Are you sure?"}
        </p>
      </Modal>
    </div>
  );
};
