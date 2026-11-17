import { Send } from "lucide-react";
import { ActionButton } from "../../components/resource/ActionButton";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { Skeleton } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { cx } from "../../lib/cx";
import { date, daysAgo, number, today } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";

// Milk can go to MVA only from what was recorded at that milking (date, dairy
// and session) and not sent yet; the server holds to the same rule.

const litres = (value) => `${number(value)} L`;
const DAILY = "/livestock/milk-records/daily";
const DAYS_SHOWN = 7;

/** What is left of one milking, from the daily totals (recorded and sent per milking). */
const milkingOf = (rows, { date: day, dairy, session }) => {
  const row = (rows || []).find((r) => String(r.date).slice(0, 10) === day && r.dairy === dairy && r.session === session);
  const recorded = row?.litres || 0;
  const sent = row?.sentToMva || 0;
  return { recorded, sent };
};

/**
 * In the send form: the milk recorded at the chosen milking, what has gone
 * to MVA from it and what is left, with a warning when more is entered.
 * Changing a transfer, its own litres count as still here, and it can
 * always be lowered - even one sent before milk had to be recorded first.
 */
export const MilkLeftNote = ({ values }) => {
  const { label } = useAuth();
  const ready = Boolean(values.date && values.dairy && values.session);
  const { data, loading } = useFetch(ready ? DAILY : null, { from: values.date, to: values.date });
  if (!ready) return <p className="border-l-2 border-slate-200 pl-3 text-sm text-slate-500">Choose the date, dairy and session to see the milk recorded at that milking.</p>;
  if (loading && !data) return <Skeleton className="h-10 w-full" />;

  const totals = milkingOf(data, values);
  const own = values._sent && values._sent.dairy === values.dairy && values._sent.session === values.session ? values._sent.litres : 0;
  const sent = Math.round((totals.sent - own) * 100) / 100;
  const left = Math.round((totals.recorded - sent) * 100) / 100;
  // What this form may send: what is left, or - changing a transfer - no more than it already sent.
  const allowed = Math.max(left, own);
  const typed = values.litres === "" || values.litres == null ? null : Number(values.litres);
  const over = typed !== null && typed > allowed + 0.001;
  const milking = `${label("dairies", values.dairy)} ${label("milkSessions", values.session).toLowerCase()} milking, ${date(values.date)}`;
  const overLine = over && <p className="mt-1 font-medium text-rose-700">That is more than the {litres(Math.max(allowed, 0))} {own > left ? "this transfer already sent" : "left at this milking"}.</p>;

  if (!totals.recorded) {
    return (
      <div role="status" className={cx("border-l-2 pl-3 text-sm", over ? "border-rose-500" : "border-amber-400")}>
        <p className="text-amber-800">
          {own
            ? `No milk is recorded for the ${milking}: this transfer was sent before milk had to be recorded. Its notes can be changed and its litres lowered, not raised.`
            : `No milk is recorded for the ${milking}. Record the milking under Milk records before sending it.`}
        </p>
        {overLine}
      </div>
    );
  }
  return (
    <div role="status" className={cx("border-l-2 pl-3 text-sm", over ? "border-rose-500" : left > 0 ? "border-primary-500" : "border-slate-300")}>
      <p className="text-slate-600">
        {milking}: <span className="tabular-nums">{litres(totals.recorded)}</span> recorded, <span className="tabular-nums">{litres(sent)}</span> already sent.{" "}
        <strong className="font-semibold tabular-nums text-slate-900">{left > 0 ? `${litres(left)} left to send` : "Nothing left to send"}</strong>
      </p>
      {overLine}
    </div>
  );
};

/**
 * The To MVA page's header: today's milk, and each milking of the last week
 * that still has milk not sent, with a button that sends what is left.
 */
export const MilkToSend = ({ ctx, sendFields }) => {
  const { label, meta } = ctx;
  const { data, loading } = useFetch(DAILY, { from: daysAgo(DAYS_SHOWN - 1), to: today() });
  const rows = data || [];
  const sessionOrder = (meta?.milkSessions || []).map((s) => s.value);
  const todayRows = rows.filter((r) => String(r.date).slice(0, 10) === today());
  const recordedToday = todayRows.reduce((s, r) => s + r.litres, 0);
  const sentToday = todayRows.reduce((s, r) => s + r.sentToMva, 0);
  const waiting = rows
    .map((r) => ({ ...r, day: String(r.date).slice(0, 10), left: Math.round((r.litres - r.sentToMva) * 100) / 100 }))
    .filter((r) => r.left > 0)
    .sort((a, b) => b.day.localeCompare(a.day) || a.dairy.localeCompare(b.dairy) || sessionOrder.indexOf(a.session) - sessionOrder.indexOf(b.session));
  const leftInAll = waiting.reduce((s, r) => s + r.left, 0);
  const canSend = ctx.can("milkTransfers", "write");

  return (
    <section className="min-w-0 space-y-4" aria-label="Milk recorded and not yet sent">
      <KeyFigures
        loading={loading && !data ? 3 : 0}
        items={[
          { label: "Milk recorded today", value: litres(recordedToday) },
          { label: "Sent to MVA today", value: litres(sentToday) },
          { label: "Left to send", value: litres(leftInAll), tone: leftInAll > 0 ? "warn" : undefined, hint: waiting.length ? `${waiting.length} milking${waiting.length === 1 ? "" : "s"}, last ${DAYS_SHOWN} days` : `Last ${DAYS_SHOWN} days` },
        ]}
      />
      {data && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Milk not yet sent</h3>
          {waiting.length ? (
            <div className="mt-2">
              {/* On a phone: the milking, what is left and the button; recorded and sent from tablets up. */}
              <table className="w-full text-sm">
                <thead className="border-b border-slate-300 text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Milking</th>
                    <th className="hidden py-2 pr-4 text-right sm:table-cell">Recorded</th>
                    <th className="hidden py-2 pr-4 text-right sm:table-cell">Sent</th>
                    <th className="whitespace-nowrap py-2 pr-4 text-right">Left to send</th>
                    {canSend && <th className="w-20 py-2"><span className="sr-only">Send</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {waiting.map((r) => (
                    <tr key={`${r.day}|${r.dairy}|${r.session}`}>
                      <td className="py-2 pr-4 text-slate-800">{date(r.day)} · {label("dairies", r.dairy)} {label("milkSessions", r.session).toLowerCase()}</td>
                      <td className="hidden py-2 pr-4 text-right tabular-nums sm:table-cell">{litres(r.litres)}</td>
                      <td className="hidden py-2 pr-4 text-right tabular-nums sm:table-cell">{litres(r.sentToMva)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right font-semibold tabular-nums text-slate-900">{litres(r.left)}</td>
                      {canSend && (
                        <td className="py-1.5 text-right">
                          <ActionButton
                            label="Send"
                            title={`Send milk to MVA: ${label("dairies", r.dairy)} ${label("milkSessions", r.session).toLowerCase()}, ${date(r.day)}`}
                            icon={Send}
                            path="/livestock/milk-transfers"
                            fields={sendFields}
                            initial={{ date: r.day, dairy: r.dairy, session: r.session, litres: String(r.left) }}
                            submitLabel="Send to MVA"
                            onDone={() => ctx.notify("Milk sent to MVA")}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">All the milk recorded in the last {DAYS_SHOWN} days has been sent to MVA.</p>
          )}
        </div>
      )}
    </section>
  );
};
