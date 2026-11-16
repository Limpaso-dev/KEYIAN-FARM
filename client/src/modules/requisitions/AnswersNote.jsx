/**
 * What was answered since the user last looked, above their list of
 * requests: the latest five, the rest marked New in the list. answers come
 * from useAnswersSeen; line(row) gives one answer's number, items and status.
 */
export const AnswersNote = ({ answers, line }) => {
  if (!answers?.count) return null;
  const shown = answers.rows.slice(0, 5);
  return (
    <section aria-label="Answered since you last looked" className="mb-4 border-l-2 border-primary-500 pl-3 text-sm">
      <p className="font-semibold text-slate-900">Answered since you last looked{answers.count > 1 ? ` (${answers.count})` : ""}</p>
      <ul className="mt-1.5 space-y-1">
        {shown.map((row) => <li key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600">{line(row)}</li>)}
      </ul>
      {answers.count > shown.length && <p className="mt-1 text-xs text-slate-500">{answers.count - shown.length} more, marked New in the list below.</p>}
    </section>
  );
};
