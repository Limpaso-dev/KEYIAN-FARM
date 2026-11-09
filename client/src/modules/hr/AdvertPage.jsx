import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { BriefcaseBusiness } from "lucide-react";
import { ResourcePage } from "../../components/resource/ResourcePage";
import { KeyFigures } from "../../components/ui/KeyFigures";
import { Alert, Badge, PageHeader, Spinner } from "../../components/ui/ui";
import { useAuth } from "../../context/useAuth";
import { date } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";
import { Details } from "./Details";
import { applicantsFor } from "./establishment";

/** One job advert: where its applicants stand, and the next step for each. */
const AdvertPage = () => {
  const { id } = useParams();
  const { label } = useAuth();
  const { data: advert, loading, error, reload } = useFetch(`/hr/job-adverts/${id}`);
  const config = useMemo(() => (advert ? applicantsFor(advert) : null), [advert]);

  if (loading && !advert) return <Spinner />;
  if (!advert) return <Alert tone="error">{error || "This job advert could not be found."}</Alert>;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={BriefcaseBusiness}
        eyebrow="Staff establishment"
        title={<span className="inline-flex flex-wrap items-center gap-3">{advert.jobTitle}<Badge value={advert.status}>{label("advertStatus", advert.status)}</Badge></span>}
        description={`${advert.advertNumber} · ${label("departments", advert.department)}`}
      />

      <Details
        title="Job advert"
        items={[
          ["Advert date", date(advert.advertDate)],
          ["Closing date", date(advert.closingDate)],
          ["Number of posts", advert.posts],
          ["Job group", advert.jobGroup],
          ["Employment type", label("employmentTypes", advert.employmentType)],
          ...(advert.requirements ? [["Requirements", advert.requirements]] : []),
        ]}
      />

      <ResourcePage
        config={config}
        onChange={reload}
        header={({ rows }) => {
          const at = (stage) => rows.filter((row) => row.stage === stage).length;
          return (
            <KeyFigures
              columns={6}
              items={[
                { label: "Applications", value: rows.length },
                { label: "Shortlisted", value: at("shortlisted") },
                { label: "Interview scheduled", value: at("interview") },
                { label: "Passed interview", value: at("passed") },
                { label: "Hired", value: `${at("hired")} of ${advert.posts}` },
                { label: "Not successful", value: at("rejected") },
              ]}
            />
          );
        }}
      />
    </div>
  );
};

export default AdvertPage;
