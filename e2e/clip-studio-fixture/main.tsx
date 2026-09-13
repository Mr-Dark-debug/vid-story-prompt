import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { JobWizard } from "../../src/components/youtube-clipper/job-wizard";
import { PLAN_ENTITLEMENTS } from "../../src/domain/clipping/entitlements";
import "../../src/styles.css";

export function Fixture() {
  const [submitted, setSubmitted] = useState<unknown>(null);
  useEffect(() => {
    const listener = (event: Event) => setSubmitted((event as CustomEvent).detail);
    window.addEventListener("fixture:submitted", listener);
    return () => window.removeEventListener("fixture:submitted", listener);
  }, []);
  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 16 }}>
      <p>
        Browser UI contract fixture. Authentication, acquisition and export are not exercised here.
      </p>
      <JobWizard
        initialYoutube="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        creationContext={{
          plan: "free",
          entitlement: PLAN_ENTITLEMENTS.free,
          activeJobs: 0,
          reservedSeconds: 3540,
          committedSeconds: 0,
          exactCutAvailable: true,
        }}
      />
      <output
        data-testid="submitted-request"
        style={{ display: "block", overflowWrap: "anywhere" }}
      >
        {submitted ? JSON.stringify(submitted) : "No request submitted"}
      </output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
