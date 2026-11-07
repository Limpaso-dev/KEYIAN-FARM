import { useState } from "react";
import { post } from "../../lib/api";
import { clearFetchCache } from "../../lib/useFetch";
import { FormModal } from "../forms/Form";
import { Button } from "../ui/ui";

/** A toolbar button that opens a form and POSTs it. */
export const ActionButton = ({ label, icon, title, fields, initial, path, toPayload, onDone, submitLabel, variant = "secondary", size = "sm", modalSize, intro }) => {
  const [open, setOpen] = useState(false);
  const submit = async (values) => {
    const result = await post(typeof path === "function" ? path(values) : path, toPayload ? toPayload(values) : values);
    clearFetchCache();
    setOpen(false);
    onDone?.(result);
  };
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)}>{label}</Button>
      {open && <FormModal open title={title || label} fields={fields} initial={initial} onSubmit={submit} onClose={() => setOpen(false)} submitLabel={submitLabel || label} size={modalSize} intro={intro} />}
    </>
  );
};
