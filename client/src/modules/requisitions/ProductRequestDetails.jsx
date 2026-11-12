import { dateTime, number } from "../../lib/format";

/** A product request opened in the list: what was asked for and what came of it. */
export const ProductRequestDetails = ({ row, to }) => {
  const handled = !["pending", "cancelled", "declined"].includes(row.status);
  return (
    <div className="grid gap-6 text-sm md:grid-cols-2">
      <table className="w-full max-w-md">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="py-1">Product</th><th className="text-right">Asked for</th>{handled && <th className="text-right">{to === "mva" ? "Sent" : "Given out"}</th>}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {row.items.map((i) => (
            <tr key={i.id}><td className="py-1.5">{i.product?.name}</td><td className="text-right">{number(i.quantity)} {i.product?.unit}</td>{handled && <td className="text-right">{number(i.quantityGiven)}</td>}</tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1 text-slate-600">
        {row.purpose && <p><span className="font-medium text-slate-700">{to === "mva" ? "Notes" : "For"}:</span> {row.purpose}</p>}
        <p><span className="font-medium text-slate-700">Asked by:</span> {row.requestedBy?.name} on {dateTime(row.createdAt)}</p>
        {row.handledBy && <p><span className="font-medium text-slate-700">{row.status === "declined" ? "Declined" : to === "mva" ? "Sent" : "Given out"} by:</span> {row.handledBy.name} on {dateTime(row.handledAt)}</p>}
        {row.declineReason && <p><span className="font-medium text-slate-700">Reason:</span> {row.declineReason}</p>}
        {row.transfer && <p><span className="font-medium text-slate-700">Transfer:</span> {row.transfer.transferNumber} ({row.transfer.status === "received" ? "received by Sales" : "on its way - receive it under Sales, From MVA"})</p>}
        {row.officeRecords?.length > 0 && <p><span className="font-medium text-slate-700">Office use:</span> {row.officeRecords.map((r) => r.recordNumber).join(", ")}</p>}
      </div>
    </div>
  );
};
