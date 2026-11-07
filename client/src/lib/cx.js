/** Join class names, skipping falsy ones. */
export const cx = (...classes) => classes.filter(Boolean).join(" ");
