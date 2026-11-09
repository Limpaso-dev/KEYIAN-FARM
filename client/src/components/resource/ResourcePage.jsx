import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, FilterX, Pencil, Plus, RefreshCw, Search, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { del, errorMessage, post, put } from "../../lib/api";
import { cx } from "../../lib/cx";
import { date, money, number } from "../../lib/format";
import { showError, toast } from "../../lib/toast";
import { clearFetchCache, useFetch } from "../../lib/useFetch";
import { FormModal } from "../forms/Form";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton } from "../ui/ui";

// Column: { key, label, type?: date|money|number|status:<list>|option:<list>|bool, render?(row, ctx), align?, sortable? }
// Action: { key, label, icon, when?(row, ctx), allowed?(ctx), path(row), method?, fields?, initial?(row),
//           confirm?, submitLabel?, tone?, size?, title?(row) }

const PAGE_SIZE = 25;

const rawValue = (column, row) => column.key.split(".").reduce((obj, part) => obj?.[part], row);

const cellValue = (column, row, ctx) => {
  if (column.render) return column.render(row, ctx);
  const value = rawValue(column, row);
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

/** Sort only on plain values (numbers, strings, dates); rendered objects are left alone. */
const sortValue = (column, row) => {
  const value = rawValue(column, row);
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (isNumeric(column) && !Number.isNaN(Number(value))) return Number(value);
    return value.toLowerCase();
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
};

const SkeletonRows = ({ columns }) => (
  <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex gap-6 px-4 py-3.5">
        {Array.from({ length: Math.min(columns, 6) }).map((__, j) => <Skeleton key={j} className={cx("h-4", j === 0 ? "w-28" : "flex-1")} />)}
      </div>
    ))}
  </div>
);

const Pagination = ({ page, pages, total, onPage }) => {
  if (pages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <p>Showing <span className="font-medium text-slate-700">{start}–{end}</span> of <span className="font-medium text-slate-700">{total}</span></p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
        <span className="px-2 tabular-nums">Page {page} of {pages}</span>
        <Button size="sm" variant="secondary" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  );
};

export const DataTable = ({ columns, rows, ctx, actions = [], expand, emptyText, rowTo }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const [sort, setSort] = useState(null); // { key, dir }
  const [pageState, setPageState] = useState({ page: 1, count: rows.length });

  // A new result set (filters changed, record added) starts at page 1.
  const page = pageState.count === rows.length ? pageState.page : 1;
  const setPage = (next) => setPageState({ page: next, count: rows.length });

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = sortValue(column, a);
      const y = sortValue(column, b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x < y ? -dir : x > y ? dir : 0;
    });
  }, [rows, sort, columns]);

  if (!rows.length) return <EmptyState title={emptyText || "No records found"}>Try changing the filters, or add a new record.</EmptyState>;

  const pages = Math.ceil(sorted.length / PAGE_SIZE);
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const sortable = (c) => c.sortable !== false && rows.some((r) => sortValue(c, r) !== undefined && sortValue(c, r) !== null);
  const toggleSort = (key) => setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return (
    <>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
              {expand && <th className="w-10" aria-label="Details" />}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const can = sortable(c);
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className={cx("whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-slate-500", isNumeric(c) && "text-right")}>
                    {can ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className={cx("group inline-flex items-center gap-1 rounded transition hover:text-slate-900", active && "text-slate-900", isNumeric(c) && "flex-row-reverse")}>
                        {c.label}
                        {active ? (sort.dir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} className="opacity-0 transition group-hover:opacity-60" />}
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
              {actions.length > 0 && <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => {
              const visibleActions = actions.filter((a) => !a.when || a.when(row, ctx));
              const isOpen = open === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    className={cx("transition-colors hover:bg-slate-50", rowTo && "cursor-pointer", isOpen && "bg-slate-50")}
                    onClick={rowTo ? (event) => !event.target.closest("a, button, input, select, label") && navigate(rowTo(row)) : undefined}
                  >
                    {expand && (
                      <td className="pl-3">
                        <button type="button" aria-label={isOpen ? "Hide details" : "Show details"} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : row.id)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                    )}
                    {columns.map((c, i) => (
                      <td key={c.key} className={cx("px-4 py-3 align-middle text-slate-700", i === 0 && !expand && "font-medium text-slate-900", isNumeric(c) && "whitespace-nowrap text-right tabular-nums", c.className)}>
                        {cellValue(c, row, ctx)}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {visibleActions.map((a) => (
                            <Button
                              key={a.key}
                              size="sm"
                              variant={a.variant || (a.label ? "secondary" : "ghost")}
                              icon={a.icon}
                              onClick={() => a.onClick(row)}
                              aria-label={a.ariaLabel?.(row)}
                              title={a.ariaLabel?.(row)}
                              className={a.key === "delete" ? "hover:bg-rose-50 hover:text-rose-700" : undefined}
                            >
                              {a.label}
                            </Button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expand && isOpen && (
                    <tr className="bg-slate-50/70"><td colSpan={columns.length + 2} className="px-6 py-4 animate-slide-down">{expand(row, ctx)}</td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={current} pages={pages} total={sorted.length} onPage={setPage} />
    </>
  );
};

/** Filter bar: search, selects and a date range, with a reset. */
const Filters = ({ filters, query, setQuery, initial }) => {
  const { meta } = useAuth();
  if (!filters?.length) return null;
  const changed = JSON.stringify(Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""))) !== JSON.stringify(initial || {});
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-white px-4 py-3">
      {filters.map((f) => {
        if (f.type === "search") {
          return (
            <div key="search" className="relative w-full sm:w-72">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input type="search" aria-label="Search" placeholder={f.placeholder || "Search..."} className="pl-9" value={query.search || ""} onChange={(e) => setQuery({ ...query, search: e.target.value })} />
            </div>
          );
        }
        if (f.type === "dateRange") {
          return (
            <div key="dates" className="flex items-end gap-2">
              <label className="block text-xs font-medium text-slate-500">From<Input type="date" className="mt-1 block w-[9.5rem]" value={query.from || ""} onChange={(e) => setQuery({ ...query, from: e.target.value })} /></label>
              <label className="block text-xs font-medium text-slate-500">To<Input type="date" className="mt-1 block w-[9.5rem]" value={query.to || ""} onChange={(e) => setQuery({ ...query, to: e.target.value })} /></label>
            </div>
          );
        }
        const options = typeof f.options === "string" ? meta?.[f.options] || [] : f.options || [];
        return (
          <label key={f.name} className="block min-w-[150px] text-xs font-medium text-slate-500">
            {f.label}
            <Select className="mt-1 block" options={options} placeholder="All" value={query[f.name] || ""} onChange={(e) => setQuery({ ...query, [f.name]: e.target.value })} />
          </label>
        );
      })}
      {changed && <Button variant="ghost" size="md" icon={FilterX} onClick={() => setQuery(initial || {})}>Reset</Button>}
    </div>
  );
};

/**
 * Generic page for one API collection. See modules/* for examples.
 * config.rowTo(row): clicking a row opens this address.
 * config.labelRowButtons: show "Edit" and "Delete" in words, not just icons.
 * header({ ...ctx, rows, query, setQuery }): shown above the table. onChange(): after any save.
 */
export const ResourcePage = ({ config, header, onChange }) => {
  const auth = useAuth();
  const [query, setQuery] = useState(config.defaultQuery || {});
  const [debounced, setDebounced] = useState(query);
  const [form, setForm] = useState(null); // { mode, row, action }
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // rich messages (e.g. a one-time password) stay on screen

  // Debounce typing in the search box.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = Object.fromEntries(Object.entries({ ...config.params, ...debounced }).filter(([, v]) => v !== "" && v != null));
  const { data, loading, error: loadError, reload } = useFetch(config.endpoint, params);
  const rows = config.transform ? config.transform(data || []) : data || [];

  // Plain messages are confirmed with a toast; anything richer (such as a
  // temporary password shown once) stays on the page until dismissed.
  const announce = (message) => {
    if (!message) return;
    if (typeof message === "string") toast(message);
    else setNotice(message);
  };

  // notify() is used by toolbar buttons: refresh the list and confirm.
  const notify = (message) => {
    clearFetchCache();
    reload();
    onChange?.();
    announce(message || "Saved");
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
    onChange?.();
    announce(message);
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
    setBusy(true);
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
      const what = confirm.kind === "delete" ? `delete this ${config.singular?.toLowerCase() || "record"}` : (confirm.action?.label || "do that").toLowerCase();
      showError(errorMessage(err, "That did not work. Please try again."), `Could not ${what}`);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const rowActions = [
    ...(config.actions || [])
      .filter((a) => !a.allowed || a.allowed(ctx))
      .map((a) => ({
        ...a,
        onClick: (row) => (a.fields ? setForm({ mode: "action", row, action: a }) : setConfirm({ kind: "action", action: a, row })),
      })),
    ...(canEdit ? [{ key: "edit", label: config.labelRowButtons ? "Edit" : "", ariaLabel: () => "Edit", icon: Pencil, when: config.editableWhen, onClick: (row) => setForm({ mode: "edit", row }) }] : []),
    ...(canDelete ? [{ key: "delete", label: config.labelRowButtons ? "Delete" : "", ariaLabel: () => "Delete", icon: Trash2, variant: "ghost", when: config.deletableWhen, onClick: (row) => setConfirm({ kind: "delete", row }) }] : []),
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
        icon: a.icon,
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
      icon: create ? Plus : Pencil,
    };
  })();

  const isDelete = confirm?.kind === "delete";

  return (
    <div className="space-y-5">
      <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>
      {header?.({ ...ctx, rows, query, setQuery })}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900">{config.title}</h2>
              {data && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{rows.length}</span>}
            </div>
            {config.description && <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-slate-500">{config.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={reload} aria-label="Refresh" title="Refresh" className={loading ? "[&>svg]:animate-spin" : undefined} />
            {config.toolbar?.(ctx)}
            {canCreate && config.createFields && <Button size="sm" icon={Plus} onClick={() => setForm({ mode: "create" })}>{config.createLabel || `Add ${config.singular?.toLowerCase() || ""}`}</Button>}
          </div>
        </div>
        <Filters filters={config.filters} query={query} setQuery={setQuery} initial={config.defaultQuery} />
        {loadError && <div className="p-4"><Alert tone="error">{loadError}</Alert></div>}
        {loading && !data ? <SkeletonRows columns={config.columns.length} /> : (
          <DataTable columns={config.columns} rows={rows} ctx={ctx} actions={rowActions} expand={config.expand} emptyText={config.emptyText} rowTo={config.rowTo} />
        )}
        {config.footer && <div className="bg-slate-50/60 font-medium [&>div]:border-slate-200">{config.footer(rows, ctx)}</div>}
      </Card>

      {formConfig && (
        <FormModal open title={formConfig.title} fields={formConfig.fields} initial={formConfig.initial} onSubmit={submitForm} onClose={() => setForm(null)} submitLabel={formConfig.submitLabel} size={formConfig.size} intro={formConfig.intro} tone={formConfig.tone} icon={formConfig.icon} />
      )}

      <Modal
        open={Boolean(confirm)}
        size="sm"
        icon={isDelete ? TriangleAlert : confirm?.action?.icon}
        tone={isDelete || confirm?.action?.tone === "danger" ? "danger" : undefined}
        title={isDelete ? `Delete this ${config.singular?.toLowerCase() || "record"}?` : confirm?.action?.label}
        onClose={() => setConfirm(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={isDelete ? "danger" : "primary"} loading={busy} onClick={runConfirm}>{isDelete ? "Delete" : confirm?.action?.submitLabel || "Confirm"}</Button>
          </>
        )}
      >
        <p className="text-sm leading-relaxed text-slate-600">
          {isDelete ? "This record will be removed permanently. This cannot be undone." : confirm?.action?.confirm?.(confirm.row) || "Are you sure?"}
        </p>
      </Modal>
    </div>
  );
};
