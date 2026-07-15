import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";

interface EditorialHeadlineProps {
  text: string;
  delay?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
}

export const EditorialHeadline: React.FC<EditorialHeadlineProps> = ({
  text,
  delay = 0,
  color = COLORS.ink,
  fontSize = 48,
  fontWeight = 800,
  letterSpacing = "-0.035em",
  align = "left",
  lineHeight = 1.15,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Create a spring animation for the text line entrance
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, mass: 0.9, stiffness: 100 },
  });

  const translateY = interpolate(progress, [0, 1], [100, 0]);
  const opacity = interpolate(progress, [0, 0.4, 1], [0, 0.5, 1]);

  return (
    <div
      style={{
        overflow: "hidden",
        width: "100%",
        display: "flex",
        justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <h2
        style={{
          fontFamily: "Manrope",
          fontSize,
          fontWeight,
          letterSpacing,
          color,
          lineHeight,
          margin: 0,
          textAlign: align,
          transform: `translateY(${translateY}%)`,
          opacity,
          transformOrigin: "bottom center",
        }}
      >
        {text}
      </h2>
    </div>
  );
};

export const MultiLineHeadline: React.FC<{
  lines: string[];
  startDelay?: number;
  lineGap?: number;
  color?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
}> = ({
  lines,
  startDelay = 0,
  lineGap = 12,
  color = COLORS.ink,
  fontSize = 48,
  align = "left",
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: lineGap,
        width: "100%",
      }}
    >
      {lines.map((line, idx) => (
        <EditorialHeadline
          key={idx}
          text={line}
          delay={startDelay + idx * 8} // stagger lines
          color={color}
          fontSize={fontSize}
          align={align}
        />
      ))}
    </div>
  );
};
