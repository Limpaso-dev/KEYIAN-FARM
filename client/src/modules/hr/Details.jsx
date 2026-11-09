/** A titled block of label and value rows, ruled like a statement - no box. */
export const Details = ({ title, items, className }) => (
  <section className={className}>
    <h2 className="border-b border-slate-200 pb-2.5 text-[15px] font-semibold text-slate-900">{title}</h2>
    <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
      {items.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-6 border-b border-slate-200 py-2.5">
          <dt className="shrink-0 text-[13px] text-slate-600">{name}</dt>
          <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">{value === "" || value == null ? "-" : value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
