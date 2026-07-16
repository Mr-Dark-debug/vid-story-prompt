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

const path =
  "M1 209.434C58.5872 255.935 387.926 325.938 482.583 209.434C600.905 63.8051 525.516 -43.2211 427.332 19.9613C329.149 83.1436 352.902 242.723 515.041 267.302C644.752 286.966 943.56 181.94 995 156.5";

export function ConnectorPathMarquee() {
  return (
    <section aria-labelledby="connector-marquee-title" className="relative">
      <h2 id="connector-marquee-title" className="sr-only">
        Import from the tools you already use
      </h2>
      <MarqueeAlongSvgPath
        path={path}
        viewBox="0 0 996 330"
        baseVelocity={8}
        slowdownOnHover
        slowDownFactor={0.2}
        draggable
        dragSensitivity={0.1}
        grabCursor
        repeat={2}
        className="h-56 w-full sm:h-[20.625rem]"
      >
        {displayedConnectors.map((connector) => (
          <div
            key={connector.id}
            data-connector-id={connector.id}
            role="img"
            aria-label={connector.label}
            className="flex h-14 w-14 select-none items-center justify-center rounded-2xl border border-line bg-surface-panel shadow-sm transition duration-300 ease-out hover:z-20 hover:scale-150 hover:border-line-strong hover:shadow-lg sm:h-16 sm:w-16"
            title={connector.label}
          >
            <ConnectorIcon
              connectorId={connector.id}
              icon={connector.icon}
              className="h-7 w-7 text-ink sm:h-8 sm:w-8"
            />
          </div>
        ))}
      </MarqueeAlongSvgPath>
    </section>
  );
}
