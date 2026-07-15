import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";

export const LogoMark: React.FC<{
  size?: number;
  color?: string;
  animate?: boolean;
}> = ({ size = 100, color = COLORS.ink, animate = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fine-tuned animation: split portal paths coming together
  // Path 1 comes from the left-top, Path 2 comes from the right-bottom
  const progress = animate
    ? spring({
        frame,
        fps,
        config: { damping: 14, mass: 0.8 },
      })
    : 1;

  const leftOffset = interpolate(progress, [0, 1], [-20, 0]);
  const leftOpacity = interpolate(progress, [0, 1], [0, 1]);
  
  const rightOffset = interpolate(progress, [0, 1], [20, 0]);
  const rightOpacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        width: size,
        height: size,
        display: "block",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {/* Left Path: M10 15 50 55v30H10V15Z */}
      <path
        fill={color}
        d="M10 15 50 55v30H10V15Z"
        style={{
          transform: `translate(${leftOffset}px, ${leftOffset}px)`,
          opacity: leftOpacity,
        }}
      />
      {/* Right Path: M58 15c17.67 0 32 14.33 32 32v38h-3L58 58h10V47H58V15Z */}
      <path
        fill={color}
        d="M58 15c17.67 0 32 14.33 32 32v38h-3L58 58h10V47H58V15Z"
        style={{
          transform: `translate(${rightOffset}px, ${rightOffset}px)`,
          opacity: rightOpacity,
        }}
      />
    </svg>
  );
};

export const VidrialLogo: React.FC<{
  size?: number;
  textColor?: string;
  markColor?: string;
  showTagline?: boolean;
  animate?: boolean;
}> = ({
  size = 40,
  textColor = COLORS.ink,
  markColor = COLORS.ink,
  showTagline = false,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wordmark fade-in after logo splits resolve
  const textProgress = animate
    ? spring({
        frame: frame - 15,
        fps,
        config: { damping: 15 },
      })
    : 1;

  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textTranslate = interpolate(textProgress, [0, 1], [10, 0]);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.3,
      }}
    >
      <LogoMark size={size} color={markColor} animate={animate} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1,
          opacity: textOpacity,
          transform: `translateX(${textTranslate}px)`,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontWeight: 800,
            fontSize: size * 0.7,
            letterSpacing: "-0.055em",
            color: textColor,
          }}
        >
          VIDRIAL
        </span>
        {showTagline && (
          <span
            style={{
              marginTop: size * 0.1,
              fontFamily: "Manrope",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.17em",
              fontSize: size * 0.14,
              color: COLORS.medium,
              opacity: 0.85,
            }}
          >
            AI-ASSISTED VIDEO EDITING
          </span>
        )}
      </div>
    </div>
  );
};
