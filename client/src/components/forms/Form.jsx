import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { errorMessage } from "../../lib/api";
import { fetchCached } from "../../lib/useFetch";
import { Alert, Button, FieldWrap, Input, Modal, Select, Spinner, Textarea } from "../ui/ui";

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

const Control = ({ field, value, onChange, id }) => {
  const options = useOptions(field);
  const common = { id, name: field.name, required: field.required, disabled: field.readOnly, placeholder: field.placeholder };
  switch (field.type) {
    case "textarea":
      return <Textarea {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      if (options === null) return <Select {...common} options={[]} placeholder="Loading..." disabled />;
      return <Select {...common} options={options} placeholder={field.placeholder || "Select..."} value={value ?? ""} onChange={(e) => onChange(e.target.value, options.find((o) => String(o.value) === e.target.value)?.row)} />;
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" id={id} checked={Boolean(value)} disabled={field.readOnly} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-700" />
          {field.checkboxLabel || field.label}
        </label>
      );
    case "display":
      return <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{field.render ? field.render(value) : value}</div>;
    default:
      return (
        <Input
          {...common}
          type={field.type || "text"}
          step={field.type === "number" ? field.step || "any" : undefined}
          min={field.type === "number" ? field.min ?? 0 : undefined}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

/** Table editor for line items. */
const ItemsField = ({ field, value, onChange }) => {
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
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
          <tr>
            {field.columns.map((c) => <th key={c.name} className="px-2 py-2" style={{ width: c.width }}>{c.label}{c.required && <span className="text-rose-600">*</span>}</th>)}
            {!field.fixedRows && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {field.columns.map((c) => (
                <td key={c.name} className="px-2 py-1.5 align-top">
                  {c.type === "display"
                    ? <span className="block py-2 text-slate-700">{c.render ? c.render(row) : row[c.name]}</span>
                    : <Control field={{ ...c, required: c.required }} value={row[c.name]} onChange={(next, picked) => update(index, c.name, next, picked)} id={`${field.name}-${index}-${c.name}`} />}
                </td>
              ))}
              {!field.fixedRows && (
                <td className="px-1 text-center">
                  <button type="button" aria-label="Remove line" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={field.columns.length + 1} className="px-3 py-4 text-center text-sm text-slate-500">No lines yet</td></tr>}
        </tbody>
        {total !== null && (
          <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold"><td className="px-2 py-2" colSpan={field.columns.length - 1}>Total</td><td className="px-2 py-2">{field.formatTotal ? field.formatTotal(total) : total}</td>{!field.fixedRows && <td />}</tr></tfoot>
        )}
      </table>
      {!field.fixedRows && (
        <div className="border-t border-slate-100 p-2">
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...rows, blank()])}>{field.addLabel || "Add line"}</Button>
        </div>
      )}
    </div>
  );
};

export const FormFields = ({ fields, values, setValue }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {fields.filter((f) => !f.showIf || f.showIf(values)).map((field) => {
      const id = `field-${field.name}`;
      const span = field.span === 2 || ["textarea", "items"].includes(field.type) ? "sm:col-span-2" : "";
      return (
        <FieldWrap key={field.name} label={field.type === "checkbox" ? null : field.label} htmlFor={id} required={field.required} help={field.help} className={span}>
          {field.type === "items"
            ? <ItemsField field={field} value={values[field.name]} onChange={(next) => setValue(field.name, next)} />
            : <Control field={field} id={id} value={values[field.name]} onChange={(next, row) => setValue(field.name, next, row, field)} />}
        </FieldWrap>
      );
    })}
  </div>
);

/**
 * Modal form. `initial` may be an object or an async function returning one.
 * onSubmit(values) should throw on failure; its error message is shown.
 */
export const FormModal = ({ open, title, subtitle, fields, initial, onSubmit, onClose, submitLabel = "Save", size = "md", intro, tone = "primary" }) => {
  const [values, setValues] = useState({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        setError(errorMessage(err));
        setReady(true);
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setValue = (name, next, row, field) => {
    setValues((previous) => {
      const updated = { ...previous, [name]: next };
      if (field?.onSelect) Object.assign(updated, field.onSelect(row, updated) || {});
      return updated;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const visible = Object.fromEntries(fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => [f.name, values[f.name]]));
      await onSubmit({ ...values, ...visible });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const formId = `form-${useId().replace(/:/g, "")}`;

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      size={size}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={saving} disabled={!ready} variant={tone}>{submitLabel}</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate={false}>
        {intro}
        <Alert tone="error">{error}</Alert>
        {ready ? <FormFields fields={fields} values={values} setValue={setValue} /> : <Spinner />}
      </form>
    </Modal>
  );
};
