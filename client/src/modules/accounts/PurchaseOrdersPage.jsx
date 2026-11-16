import { ResourcePage } from "../../components/resource/ResourcePage";
import { Badge } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { useAnswersSeen } from "../../lib/useNavCounts";
import { AnswersNote } from "../requisitions/AnswersNote";
import { purchaseOrdersConfig } from "./orders";

/**
 * Purchase orders, with what Stores has received against them since the
 * Accounts officer last looked. Opening them clears the count in the sidebar.
 */
export const PurchaseOrders = () => {
  const { user, label } = useAuth();
  const deliveries = useAnswersSeen("/accounts/purchase-orders/deliveries/seen", user?.department === "accounts");
  return (
    <>
      <AnswersNote
        title="Deliveries recorded since you last looked"
        answers={deliveries}
        line={(r) => (
          <>
            <span className="font-medium tabular-nums text-slate-800">{r.poNumber}</span>
            <span>{r.supplier?.name}</span>
            <Badge value={r.status}>{label("purchaseOrderStatus", r.status)}</Badge>
            {r.deliveryNote && <span className="text-slate-500">{r.deliveryNote}</span>}
          </>
        )}
      />
      <ResourcePage config={purchaseOrdersConfig(deliveries)} />
    </>
  );
};
