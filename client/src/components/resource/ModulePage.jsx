import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { PageHeader, Tabs } from "../ui/ui";

/**
 * A department page made of tabs. Each tab: { key, label, show?(ctx), render(ctx) }.
 * The open tab is kept in the URL (?tab=...) so it survives refresh.
 */
export const ModulePage = ({ title, description, tabs, actions }) => {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const visible = tabs.filter((tab) => !tab.show || tab.show(auth));
  const active = visible.find((tab) => tab.key === params.get("tab")) || visible[0];
  return (
    <div>
      <PageHeader title={title} description={description} actions={actions} />
      {visible.length > 1 && (
        <Tabs tabs={visible} active={active?.key} onChange={(key) => setParams({ tab: key }, { replace: true })} />
      )}
      {active ? <div key={active.key}>{active.render(auth)}</div> : <p className="text-sm text-slate-500">You do not have access to any part of this department.</p>}
    </div>
  );
};
