import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MotionBriefForm } from "../../src/components/motion/motion-brief-form";
import { MotionProjectEditor } from "../../src/components/motion/motion-project-editor";
import { capabilities, usage, snapshot } from "./providers";
import "../../src/styles.css";
export function Fixture() {
  const [editor, setEditor] = useState(false),
    [detail, setDetail] = useState(snapshot());
  useEffect(() => {
    const navigate = () => {
        setDetail(snapshot());
        setEditor(true);
      },
      refresh = () => setDetail(snapshot());
    window.addEventListener("motion-fixture:navigate", navigate);
    window.addEventListener("motion-fixture:refresh", refresh);
    return () => {
      window.removeEventListener("motion-fixture:navigate", navigate);
      window.removeEventListener("motion-fixture:refresh", refresh);
    };
  }, []);
  return (
    <main className="mx-auto max-w-6xl p-4">
      <p className="mb-6 rounded-lg border border-line p-3 text-sm">
        Labelled browser fixture: authenticated session, model generation and export queue are
        mocked at service boundaries. The isolated preview is real; downloads use our verified
        authored demo MP4. This does not verify a production worker or provider.
      </p>
      {editor ? (
        <MotionProjectEditor detail={detail} capabilities={capabilities} />
      ) : (
        <MotionBriefForm capabilities={capabilities} usage={usage} />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
