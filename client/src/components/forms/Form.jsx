import { useEffect, useId, useRef, useState } from "react";
import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { errorMessage } from "../../lib/api";
import { cx } from "../../lib/cx";
import { showError } from "../../lib/toast";
import { fetchCached } from "../../lib/useFetch";
import { Alert, Button, FieldWrap, Input, Kbd, Modal, Select, Spinner, Textarea } from "../ui/ui";

// Field definition:
//   { name, label, type, required, options | ref, span, help, placeholder,
//     showIf(values), readOnly, step, min, columns (items), fixedRows }
// type: text | email | tel | number | date | month | textarea | select |
//       checkbox | items | display
// options: name of a server option list (string) or [{ value, label }]
// ref: { path, params, label(row), filter(row) } - options from records

/** Options for a field: from the server option lists or another endpoint. */
const useOptions = (field) => {
  const { meta } = useAuth();
  const [refOptions, setRefOptions] = useState(null);
  const ref = field.ref;
  const refKey = ref ? `${ref.path}|${JSON.stringify(ref.params || {})}` : "";

  useEffect(() => {
    if (!ref) return undefined;
    let current = true;
    fetchCached(ref.path, ref.params)
      .then((rows) => {
        if (!current) return;
        const list = (rows || []).filter((row) => (ref.filter ? ref.filter(row) : true));
        setRefOptions(list.map((row) => ({ value: row.id, label: ref.label(row), row })));
      })
      .catch(() => current && setRefOptions([]));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey]);

  if (ref) return refOptions;
  if (typeof field.options === "string") {
    const list = meta?.[field.options] || [];
    return field.optionFilter ? list.filter(field.optionFilter) : list;
  }
  return field.options || [];
};

const INVALID = "border-rose-400 hover:border-rose-500 focus:border-rose-500 focus:ring-rose-500/10";

const Control = ({ field, value, onChange, id, invalid }) => {
  const options = useOptions(field);
  const common = {
    id,
    name: field.name,
    required: field.required,
    disabled: field.readOnly,
    placeholder: field.placeholder,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `${id}-error` : field.help ? `${id}-help` : undefined,
    className: cx(invalid && INVALID),
    tall: true,
  };
  switch (field.type) {
    case "textarea":
      return <Textarea {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      if (options === null) return <Select {...common} options={[]} placeholder="Loading..." disabled />;
      return <Select {...common} options={options} placeholder={field.placeholder || "Select..."} value={value ?? ""} onChange={(e) => onChange(e.target.value, options.find((o) => String(o.value) === e.target.value)?.row)} />;
    case "checkbox":
      return (
        <label className={cx("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition", value ? "border-primary-300 bg-primary-50/60 text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300", field.readOnly && "cursor-not-allowed opacity-60")}>
          <input type="checkbox" id={id} checked={Boolean(value)} disabled={field.readOnly} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-primary-700" />
          <span className="font-medium">{field.checkboxLabel || field.label}</span>
        </label>
      );
    case "display":
      return <div className="flex min-h-10 items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{field.render ? field.render(value) : value}</div>;
    default:
      return (
        <Input
          {...common}
          type={field.type || "text"}
          step={field.type === "number" ? field.step || "any" : undefined}
          min={field.type === "number" ? field.min ?? 0 : undefined}
          max={field.type === "number" ? field.max : undefined}
          inputMode={field.type === "number" ? "decimal" : undefined}
          className={cx(common.className, field.type === "number" && "tabular-nums")}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

/** Table editor for line items. */
const ItemsField = ({ field, value, onChange, invalid }) => {
  const rows = Array.isArray(value) ? value : [];
  const blank = () => Object.fromEntries(field.columns.map((c) => [c.name, c.default ?? ""]));
  const update = (index, name, next, row) => {
    const copy = rows.map((r) => ({ ...r }));
    copy[index][name] = next;
    const column = field.columns.find((c) => c.name === name);
    if (column?.onSelect && row) Object.assign(copy[index], column.onSelect(row, copy[index]));
    onChange(copy);
  };
  const total = field.total ? rows.reduce((sum, row) => sum + (Number(field.total(row)) || 0), 0) : null;
  return (
    <div className={cx("scrollbar-thin overflow-x-auto rounded-lg border bg-white", invalid ? "border-rose-400" : "border-slate-200")}>
      <table className="w-full min-w-[520px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
          <tr>
            {field.columns.map((c) => <th key={c.name} className="px-3 py-2" style={{ width: c.width }}>{c.label}{c.required && <span className="text-rose-600">*</span>}</th>)}
            {!field.fixedRows && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {field.columns.map((c) => (
                <td key={c.name} className="px-2 py-1.5 align-top first:pl-3">
                  {c.type === "display"
                    ? <span className="block py-2 font-medium text-slate-800">{c.render ? c.render(row) : row[c.name]}</span>
                    : <Control field={{ ...c, required: c.required }} value={row[c.name]} onChange={(next, picked) => update(index, c.name, next, picked)} id={`${field.name}-${index}-${c.name}`} />}
                </td>
              ))}
              {!field.fixedRows && (
                <td className="px-1 text-center">
                  <button type="button" aria-label="Remove line" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={field.columns.length + 1} className="px-3 py-4 text-center text-sm text-slate-500">No lines yet</td></tr>}
        </tbody>
        {total !== null && (
          <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900"><td className="px-3 py-2.5" colSpan={field.columns.length - 1}>Total</td><td className="px-2 py-2.5 tabular-nums">{field.formatTotal ? field.formatTotal(total) : total}</td>{!field.fixedRows && <td />}</tr></tfoot>
        )}
      </table>
      {!field.fixedRows && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-1.5">
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...rows, blank()])}>{field.addLabel || "Add line"}</Button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Validation: the same rules the browser applied before (required, email,
// number range), shown next to each field instead of in browser bubbles.
// ---------------------------------------------------------------------
const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkNumber = (value, field) => {
  const n = Number(value);
  const min = field.min ?? 0;
  if (Number.isNaN(n)) return "Enter a number.";
  if (n < min) return `Must be ${min} or more.`;
  if (field.max != null && n > field.max) return `Must be ${field.max} or less.`;
  return null;
};

const validate = (fields, values) => {
  const errors = {};
  for (const f of fields) {
    if (!f.name || f.readOnly || ["display", "checkbox", "section"].includes(f.type)) continue;
    if (f.showIf && !f.showIf(values)) continue;
    const v = values[f.name];
    if (f.type === "items") {
      const rows = Array.isArray(v) ? v : [];
      if (f.required && !rows.length) {
        errors[f.name] = "Add at least one line.";
        continue;
      }
      const editable = f.columns.filter((c) => c.type !== "display" && !c.readOnly);
      const missing = editable.filter((c) => c.required && rows.some((r) => isEmpty(r[c.name])));
      if (missing.length) {
        errors[f.name] = `Fill in ${missing.map((c) => c.label.toLowerCase()).join(", ")} on every line.`;
        continue;
      }
      for (const c of editable.filter((col) => col.type === "number")) {
        const problem = rows.map((r) => (isEmpty(r[c.name]) ? null : checkNumber(r[c.name], c))).find(Boolean);
        if (problem) {
          errors[f.name] = `${c.label}: ${problem}`;
          break;
        }
      }
      continue;
    }
    if (isEmpty(v) || (typeof v === "string" && !v.trim())) {
      if (f.required) errors[f.name] = `${f.label || "This field"} is required.`;
      continue;
    }
    if (f.type === "email" && !EMAIL.test(String(v).trim())) errors[f.name] = "Enter a valid email address, like name@example.com.";
    if (f.type === "number") {
      const problem = checkNumber(v, f);
      if (problem) errors[f.name] = problem;
    }
  }
  return errors;
};

export const FormFields = ({ fields, values, setValue, errors = {} }) => (
  <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
    {fields.filter((f) => !f.showIf || f.showIf(values)).map((field, index) => {
      if (field.type === "section") {
        return (
          <div key={field.name || `section-${index}`} className={cx("sm:col-span-2", index > 0 && "border-t border-slate-100 pt-5")}>
            <h3 className="text-sm font-semibold text-slate-900">{field.label}</h3>
            {field.help && <p className="mt-0.5 text-xs text-slate-500">{field.help}</p>}
          </div>
        );
      }
      const id = `field-${field.name}`;
      const span = field.span === 2 || ["textarea", "items"].includes(field.type) ? "sm:col-span-2" : "";
      const error = errors[field.name];
      return (
        <FieldWrap key={field.name} label={field.type === "checkbox" ? null : field.label} htmlFor={id} required={field.required} help={field.help} error={error} className={span}>
          {field.type === "items"
            ? <div data-invalid={error ? "true" : undefined}><ItemsField field={field} value={values[field.name]} invalid={Boolean(error)} onChange={(next) => setValue(field.name, next)} /></div>
            : <Control field={field} id={id} invalid={Boolean(error)} value={values[field.name]} onChange={(next, row) => setValue(field.name, next, row, field)} />}
        </FieldWrap>
      );
    })}
  </div>
);

/**
 * Modal form. `initial` may be an object or an async function returning one.
 * onSubmit(values) should throw on failure; its error is shown in the error
 * dialog and the form stays open with everything the person typed.
 */
export const FormModal = ({ open, title, subtitle, fields, initial, onSubmit, onClose, submitLabel = "Save", size = "md", intro, tone = "primary", icon }) => {
  const formRef = useRef(null);
  const [values, setValues] = useState({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    // The modal is mounted fresh each time it opens, so state starts clean.
    let current = true;
    Promise.resolve(typeof initial === "function" ? initial() : initial)
      .then((data) => {
        if (!current) return;
        setValues(data || {});
        setReady(true);
      })
      .catch((err) => {
        if (!current) return;
        setLoadError(errorMessage(err));
        setReady(true);
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // After the first save attempt, messages update as the person types.
  const errors = submitted ? validate(fields, values) : {};
  const errorCount = Object.keys(errors).length;

  const setValue = (name, next, row, field) => {
    setDirty(true);
    setConfirmDiscard(false);
    setValues((previous) => {
      const updated = { ...previous, [name]: next };
      if (field?.onSelect) Object.assign(updated, field.onSelect(row, updated) || {});
      return updated;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (Object.keys(validate(fields, values)).length) {
      // Take the person to the first field that needs fixing.
      requestAnimationFrame(() => {
        formRef.current?.querySelector('[aria-invalid="true"], [data-invalid="true"] input, [data-invalid="true"] select')?.focus();
      });
      return;
    }
    setSaving(true);
    try {
      const visible = Object.fromEntries(fields.filter((f) => f.name && f.type !== "section" && (!f.showIf || f.showIf(values))).map((f) => [f.name, values[f.name]]));
      await onSubmit({ ...values, ...visible });
    } catch (err) {
      showError(errorMessage(err), "Could not save");
    } finally {
      setSaving(false);
    }
  };

  // Closing with unsaved input asks first, instead of throwing the work away.
  const requestClose = () => {
    if (saving || confirmDiscard) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  // Once the fields are on screen, put the cursor in the first one.
  useEffect(() => {
    if (!ready) return;
    formRef.current?.querySelector("input:not([disabled]):not([type=checkbox]), select:not([disabled]), textarea:not([disabled])")?.focus();
  }, [ready]);

  const formId = `form-${useId().replace(/:/g, "")}`;

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={requestClose}
      size={size}
      icon={icon}
      tone={tone === "danger" ? "danger" : undefined}
      footer={confirmDiscard ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 animate-fade-in" role="alert">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <CircleAlert size={17} className="shrink-0 text-amber-600" aria-hidden />
            Discard the changes you made?
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" autoFocus onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="danger" onClick={onClose}>Discard</Button>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <span><span className="font-semibold text-rose-600">*</span> Required</span>
            <span className="text-slate-300" aria-hidden>·</span>
            <Kbd>Ctrl</Kbd><span aria-hidden>+</span><Kbd>Enter</Kbd><span>to save</span>
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancel</Button>
            <Button type="submit" form={formId} loading={saving} disabled={!ready || Boolean(loadError)} variant={tone === "danger" ? "danger" : "primary"}>{saving ? "Saving..." : submitLabel}</Button>
          </div>
        </div>
      )}
    >
      <form ref={formRef} id={formId} onSubmit={submit} onKeyDown={onKeyDown} className="space-y-5" noValidate>
        {intro}
        <Alert tone="error">{loadError}</Alert>
        {errorCount > 0 && (
          <Alert tone="error">
            {errorCount === 1 ? "One field needs your attention" : `${errorCount} fields need your attention`} before this can be saved.
          </Alert>
        )}
        {ready ? (
          <fieldset disabled={saving} className="min-w-0 transition-opacity disabled:opacity-70">
            <FormFields fields={fields} values={values} setValue={setValue} errors={errors} />
          </fieldset>
        ) : <Spinner />}
      </form>
    </Modal>
  );
};
