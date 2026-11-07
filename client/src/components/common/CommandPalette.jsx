import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, KeyRound, LogOut, Search } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { NAV_GROUPS, navigation } from "../../navigation";
import { cx } from "../../lib/cx";
import { Kbd } from "../ui/ui";

/** Ctrl+K / Cmd+K quick navigation across every page the user can open. */
const CommandPalette = ({ open, onClose }) => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef(null);
  const list = useRef(null);

  const commands = useMemo(() => [
    ...navigation.filter((item) => item.visible(auth)).map((item) => ({
      id: item.path, label: item.label, hint: item.hint, icon: item.icon,
      group: NAV_GROUPS.find((g) => g.key === item.group)?.label, run: () => navigate(item.path),
    })),
    { id: "password", label: "Change password", hint: "Account", icon: KeyRound, group: "Account", run: () => navigate("/change-password") },
    { id: "logout", label: "Sign out", hint: "Account", icon: LogOut, group: "Account", run: () => auth.logout() },
  ], [auth, navigate]);

  const terms = query.trim().toLowerCase();
  const results = terms ? commands.filter((c) => `${c.label} ${c.hint} ${c.group}`.toLowerCase().includes(terms)) : commands;
  const active = Math.min(index, Math.max(results.length - 1, 0));

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const timer = setTimeout(() => input.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const choose = (command) => {
    onClose();
    setQuery("");
    setIndex(0);
    command?.run();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((active + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((active - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Go to" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-overlay animate-pop-in">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search size={18} className="shrink-0 text-slate-400" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onKeyDown}
            placeholder="Go to a department or page..."
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="command-results" ref={list} role="listbox" className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {results.map((command, i) => (
            <li key={command.id} id={`command-${command.id}`} role="option" aria-selected={i === active} data-index={i}>
              <button
                type="button"
                tabIndex={-1}
                onMouseMove={() => setIndex(i)}
                onClick={() => choose(command)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", i === active ? "bg-primary-50" : "")}
              >
                <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", i === active ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-500")}>
                  <command.icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{command.label}</span>
                  <span className="block truncate text-xs text-slate-500">{command.hint}</span>
                </span>
                {i === active && <CornerDownLeft size={15} className="text-primary-700" aria-hidden />}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-8 text-center text-sm text-slate-500">No page matches "{query}"</li>}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> open</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
