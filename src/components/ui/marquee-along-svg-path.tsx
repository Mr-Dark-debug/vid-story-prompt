import * as React from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";

const wrap = (min: number, max: number, value: number) => {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
};

export type MarqueeAlongSvgPathProps = {
  children: React.ReactNode;
  className?: string;
  path: string;
  pathId?: string;
  viewBox?: string;
  baseVelocity?: number;
  direction?: "normal" | "reverse";
  slowdownOnHover?: boolean;
  slowDownFactor?: number;
  repeat?: number;
  draggable?: boolean;
  dragSensitivity?: number;
  grabCursor?: boolean;
  showPath?: boolean;
};

type ViewBox = { minX: number; minY: number; width: number; height: number };

function parseViewBox(viewBox: string): ViewBox {
  const [minX = 0, minY = 0, width = 100, height = 100] = viewBox.trim().split(/\s+/).map(Number);
  return { minX, minY, width: width || 100, height: height || 100 };
}

function PathItem({
  child,
  index,
  total,
  baseOffset,
  containerRef,
  pathRef,
  viewBox,
  duplicate,
}: {
  child: React.ReactNode;
  index: number;
  total: number;
  baseOffset: MotionValue<number>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pathRef: React.RefObject<SVGPathElement | null>;
  viewBox: ViewBox;
  duplicate: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const zIndex = useMotionValue(1);

  React.useEffect(() => {
    const updatePosition = (offset: number) => {
      const container = containerRef.current;
      const pathElement = pathRef.current;
      if (!container || !pathElement?.getTotalLength || !pathElement.getPointAtLength) return;

      const length = pathElement.getTotalLength();
      const progress = wrap(0, 100, offset + (index * 100) / total) / 100;
      const point = pathElement.getPointAtLength(length * progress);
      const bounds = container.getBoundingClientRect();
      x.set(((point.x - viewBox.minX) / viewBox.width) * bounds.width);
      y.set(((point.y - viewBox.minY) / viewBox.height) * bounds.height);
      zIndex.set(Math.max(1, Math.round((point.y / viewBox.height) * 10)));
    };

    updatePosition(baseOffset.get());
    const unsubscribe = baseOffset.on("change", updatePosition);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => updatePosition(baseOffset.get()));
    if (containerRef.current) resizeObserver?.observe(containerRef.current);
    return () => {
      unsubscribe();
      resizeObserver?.disconnect();
    };
  }, [baseOffset, containerRef, index, pathRef, total, viewBox, x, y, zIndex]);

  return (
    <motion.div
      aria-hidden={duplicate || undefined}
      className="absolute left-0 top-0"
      style={{ x, y, zIndex }}
    >
      <div className="-translate-x-1/2 -translate-y-1/2">{child}</div>
    </motion.div>
  );
}

export default function MarqueeAlongSvgPath({
  children,
  className,
  path,
  pathId,
  viewBox = "0 0 100 100",
  baseVelocity = 5,
  direction = "normal",
  slowdownOnHover = false,
  slowDownFactor = 0.3,
  repeat = 1,
  draggable = false,
  dragSensitivity = 0.1,
  grabCursor = false,
  showPath = false,
}: MarqueeAlongSvgPathProps) {
  const generatedId = React.useId();
  const id = pathId ?? `marquee-path-${generatedId.replace(/:/g, "")}`;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pathRef = React.useRef<SVGPathElement>(null);
  const baseOffset = useMotionValue(0);
  const hovered = React.useRef(false);
  const dragging = React.useRef(false);
  const lastPointerX = React.useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const parsedViewBox = React.useMemo(() => parseViewBox(viewBox), [viewBox]);
  const childrenArray = React.useMemo(() => React.Children.toArray(children), [children]);
  const items = React.useMemo(
    () =>
      Array.from({ length: Math.max(1, repeat) }).flatMap((_, repeatIndex) =>
        childrenArray.map((child, childIndex) => ({
          child,
          childIndex,
          repeatIndex,
          key: `${repeatIndex}-${childIndex}`,
        })),
      ),
    [childrenArray, repeat],
  );

  useAnimationFrame((_, delta) => {
    if (prefersReducedMotion || dragging.current) return;
    const directionFactor = direction === "normal" ? 1 : -1;
    const hoverFactor = hovered.current && slowdownOnHover ? slowDownFactor : 1;
    baseOffset.set(
      wrap(
        0,
        100,
        baseOffset.get() + directionFactor * baseVelocity * hoverFactor * (delta / 1000),
      ),
    );
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    lastPointerX.current = event.clientX;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || !dragging.current) return;
    const delta = event.clientX - lastPointerX.current;
    baseOffset.set(wrap(0, 100, baseOffset.get() + delta * dragSensitivity));
    lastPointerX.current = event.clientX;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        draggable && grabCursor && "cursor-grab active:cursor-grabbing",
        className,
      )}
      onMouseEnter={() => {
        hovered.current = true;
      }}
      onMouseLeave={() => {
        hovered.current = false;
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox={viewBox}
      >
        <path
          ref={pathRef}
          id={id}
          d={path}
          fill="none"
          stroke={showPath ? "currentColor" : "none"}
        />
      </svg>
      {items.map(({ child, key, repeatIndex }, index) => (
        <PathItem
          key={key}
          child={child}
          index={index}
          total={items.length}
          baseOffset={baseOffset}
          containerRef={containerRef}
          pathRef={pathRef}
          viewBox={parsedViewBox}
          duplicate={repeatIndex > 0}
        />
      ))}
    </div>
  );
}
