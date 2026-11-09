import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { currentSection, findNavItem } from "../../navigation";
import { EmptyState, PageHeader } from "../ui/ui";

/**
 * A department page. Its sections are listed under the department in the
 * sidebar (navigation.js says which users see which); the page shows only the
 * section chosen there, named in the address (?tab=...) so it survives a
 * refresh, under a heading of department and section.
 *
 * sections: { [key]: () => content }, one for each section key in navigation.js.
 */
export const ModulePage = ({ sections }) => {
  const auth = useAuth();
  const { pathname, search } = useLocation();
  const nav = findNavItem(pathname);
  const active = currentSection(nav, auth, search);
  const render = active && sections[active.key];
  return (
    <div>
      <PageHeader icon={nav?.icon} eyebrow={active ? nav?.label : "Department"} title={active?.label || nav?.label} />
      {render
        ? <div key={active.key} className="animate-fade-in">{render()}</div>
        : <EmptyState title="No access">You do not have access to any part of this department.</EmptyState>}
    </div>
  );
};
