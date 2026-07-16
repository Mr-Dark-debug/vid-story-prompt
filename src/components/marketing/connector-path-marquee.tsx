import { ConnectorIcon } from "@/components/connectors/connector-icon";
import MarqueeAlongSvgPath from "@/components/ui/marquee-along-svg-path";
import { CONNECTOR_REGISTRY } from "@/domain/connectors/registry";

const displayedConnectors = CONNECTOR_REGISTRY.filter(
  (connector) =>
    connector.availability !== "coming_soon" &&
    connector.id !== "upload" &&
    connector.id !== "direct_link" &&
    connector.id !== "other",
);

const upperPath = "M-120 58C180 28 430 86 690 54C930 24 1110 82 1320 56";
const lowerPath = "M-120 54C180 84 430 26 690 58C930 88 1110 30 1320 56";

const horizontalFade =
  "linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%)";
const verticalFade =
  "linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)";
const marqueeMask = `${horizontalFade}, ${verticalFade}`;

type ConnectorMarqueeRowProps = {
  path: string;
  direction: "normal" | "reverse";
  hiddenFromAssistiveTechnology?: boolean;
};

function ConnectorMarqueeRow({
  path,
  direction,
  hiddenFromAssistiveTechnology = false,
}: ConnectorMarqueeRowProps) {
  return (
    <div
      data-marquee-row
      data-marquee-direction={direction}
      aria-hidden={hiddenFromAssistiveTechnology || undefined}
    >
      <MarqueeAlongSvgPath
        path={path}
        viewBox="0 0 1200 112"
        baseVelocity={7}
        direction={direction}
        slowdownOnHover
        slowDownFactor={0.2}
        draggable
        dragSensitivity={0.1}
        grabCursor
        repeat={2}
        className="h-24 w-full sm:h-28"
      >
        {displayedConnectors.map((connector) => (
          <div
            key={connector.id}
            data-connector-id={connector.id}
            role="img"
            aria-label={connector.label}
            className="flex h-12 w-12 select-none items-center justify-center rounded-2xl border border-line bg-surface-panel shadow-sm transition duration-300 ease-out hover:z-20 hover:scale-150 hover:border-line-strong hover:shadow-lg sm:h-[3.75rem] sm:w-[3.75rem]"
            title={connector.label}
          >
            <ConnectorIcon
              connectorId={connector.id}
              icon={connector.icon}
              className="h-6 w-6 text-ink sm:h-7 sm:w-7"
            />
          </div>
        ))}
      </MarqueeAlongSvgPath>
    </div>
  );
}

export function ConnectorPathMarquee() {
  return (
    <section
      aria-labelledby="connector-marquee-title"
      data-testid="connector-path-marquee"
      className="relative left-1/2 w-[100dvw] -translate-x-1/2 overflow-hidden"
      style={{
        maskImage: marqueeMask,
        maskComposite: "intersect",
        WebkitMaskImage: marqueeMask,
        WebkitMaskComposite: "source-in",
      }}
    >
      <h2 id="connector-marquee-title" className="sr-only">
        Import from the tools you already use
      </h2>
      <div className="grid gap-1 py-2 sm:gap-2">
        <ConnectorMarqueeRow path={upperPath} direction="normal" />
        <ConnectorMarqueeRow path={lowerPath} direction="reverse" hiddenFromAssistiveTechnology />
      </div>
    </section>
  );
}
