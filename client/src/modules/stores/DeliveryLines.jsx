import { dateTime, number } from "../../lib/format";
import { itemName, stillExpected, unitOf } from "./deliveryItems";

/** A delivery opened in the list: each line ordered, received and still expected. */
export const DeliveryLines = ({ row }) => (
  <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="py-1 pr-3 font-semibold">Item</th><th className="py-1 pr-3 text-right font-semibold">Ordered</th><th className="py-1 pr-3 text-right font-semibold">Received</th><th className="py-1 text-right font-semibold">Still expected</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {row.items.map((i) => (
            <tr key={i.id}>
              <td className="py-1.5 pr-3 font-medium text-slate-800">{itemName(i)}{!i.storeItem && <span className="block text-xs font-normal text-slate-500">Not a store item: not added to stock</span>}</td>
              <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">{number(i.quantity)}{unitOf(i)}</td>
              <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">{number(i.quantityReceived)}</td>
              <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{number(stillExpected(i))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="space-y-1 text-slate-600">
      {row.notes && <p><span className="font-medium text-slate-700">From Accounts:</span> {row.notes}</p>}
      {row.deliveredAt && <p><span className="font-medium text-slate-700">Last recorded:</span> {dateTime(row.deliveredAt)} by {row.deliveredBy?.name}</p>}
      {row.deliveryNote && <p><span className="font-medium text-slate-700">Note:</span> {row.deliveryNote}</p>}
    </div>
  </div>
);
