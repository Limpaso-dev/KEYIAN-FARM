import { Badge } from "../../components/ui/ui";
import { dateTime, number } from "../../lib/format";
import { requestLines } from "./requestLines";

/** One answer in the note above the To Stores list: number, items, status and any reason. */
export const StoreAnswer = ({ row, label }) => (
  <>
    <span className="font-medium tabular-nums text-slate-800">{row.requestNumber}</span>
    <span>{requestLines(row)}</span>
    <Badge value={row.status}>{label("storeRequestStatus", row.status)}</Badge>
    {row.declineReason && <span className="text-slate-500">{row.declineReason}</span>}
  </>
);

/** A store request opened in the list: what was asked for and why, and what Stores dispatched. */
export const StoreRequestDetails = ({ row }) => {
  const dispatched = row.status === "issued";
  // Requests made before each item had its own purpose carry one for the whole request.
  const perItem = row.items.some((i) => i.purpose);
  return (
    <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-semibold">Item</th>
              {perItem && <th className="py-1 pr-3 font-semibold">What it is for</th>}
              <th className="py-1 pr-3 text-right font-semibold">Asked for</th>
              {dispatched && <th className="py-1 text-right font-semibold">Dispatched</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {row.items.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="py-1.5 pr-3 font-medium text-slate-800">{i.item?.name}</td>
                {perItem && <td className="py-1.5 pr-3 text-slate-600">{i.purpose}</td>}
                <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">{number(i.quantity)} {i.item?.unit}</td>
                {dispatched && <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{number(i.quantityGiven)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
