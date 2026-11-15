import { dateTime, number } from "../../lib/format";

/** A store request opened in the list: what was asked for and what Stores dispatched. */
export const StoreRequestDetails = ({ row }) => {
  const dispatched = row.status === "issued";
  return (
    <div className="grid gap-6 text-sm md:grid-cols-2">
      <table className="w-full max-w-md">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="py-1">Item</th><th className="text-right">Asked for</th>{dispatched && <th className="text-right">Dispatched</th>}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {row.items.map((i) => (
            <tr key={i.id}>
              <td className="py-1.5">{i.item?.name}</td>
              <td className="text-right tabular-nums">{number(i.quantity)} {i.item?.unit}</td>
              {dispatched && <td className="text-right tabular-nums">{number(i.quantityGiven)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1 text-slate-600">
        {row.purpose && <p><span className="font-medium text-slate-700">For:</span> {row.purpose}</p>}
        <p><span className="font-medium text-slate-700">Asked by:</span> {row.requestedBy?.name} on {dateTime(row.createdAt)}</p>
        {row.handledBy && <p><span className="font-medium text-slate-700">{row.status === "declined" ? "Declined" : "Dispatched"} by:</span> {row.handledBy.name} on {dateTime(row.handledAt)}</p>}
        {row.declineReason && <p><span className="font-medium text-slate-700">Reason:</span> {row.declineReason}</p>}
        {row.issues?.length > 0 && (
          <>
            <p><span className="font-medium text-slate-700">Received by:</span> {[...new Set(row.issues.map((s) => s.issuedTo))].join(", ")}</p>
            <p><span className="font-medium text-slate-700">Stock out:</span> {row.issues.map((s) => s.issueNumber).join(", ")}</p>
          </>
        )}
      </div>
    </div>
  );
};
