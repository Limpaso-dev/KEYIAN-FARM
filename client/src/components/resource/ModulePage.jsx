import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { findNavItem, NAV_GROUPS } from "../../navigation";
import { EmptyState, PageHeader, Tabs } from "../ui/ui";

/**
 * A department page made of tabs. Each tab: { key, label, show?(ctx), render(ctx) }.
 * The open tab is kept in the URL (?tab=...) so it survives refresh.
 */
export const ModulePage = ({ title, description, tabs, actions }) => {
  const auth = useAuth();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const nav = findNavItem(pathname);
  const group = NAV_GROUPS.find((g) => g.key === nav?.group);
  const visible = tabs.filter((tab) => !tab.show || tab.show(auth));
  const active = visible.find((tab) => tab.key === params.get("tab")) || visible[0];
  return (
    <div>
      <PageHeader title={title} description={description} actions={actions} icon={nav?.icon} eyebrow={group?.key === "departments" ? "Department" : group?.label} />
      {visible.length > 1 && (
        <Tabs tabs={visible} active={active?.key} onChange={(key) => setParams({ tab: key }, { replace: true })} />
      )}
      {active
        ? <div key={active.key} className="animate-fade-in">{active.render(auth)}</div>
        : <EmptyState title="No access">You do not have access to any part of this department.</EmptyState>}
    </div>
  );
};
