import React, { useId } from 'react';

interface GeminiIconProps {
  size?: number;
  className?: string;
  disabled?: boolean;
  animate?: boolean;
  title?: string;
}

export function GeminiIcon({
  size = 22,
  className = '',
  disabled = false,
  animate = false,
  title = 'Gemini AI'
}: GeminiIconProps) {
  // Generate collision-free ID for SVG definitions
  const reactId = useId();
  const id = `gemini-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Bold, authentic Google Gemini 4-pointed sparkle with smooth rounded vertices
  const starPath =
    'M 47 2 C 48.5 0.5 51.5 0.5 53 2 C 55.5 24 76 44.5 98 47 C 99.5 48.5 99.5 51.5 98 53 C 76 55.5 55.5 76 53 98 C 51.5 99.5 48.5 99.5 47 98 C 44.5 76 24 55.5 2 53 C 0.5 51.5 0.5 48.5 2 47 C 24 44.5 44.5 24 47 2 Z';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 select-none ${
        disabled ? 'grayscale opacity-30' : ''
      } ${animate ? 'animate-pulse scale-105' : ''} ${className}`}
      aria-label={title}
      role="img"
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={starPath} />
        </clipPath>

        {/* Top Lobe: Rich, punchy Google Red */}
        <radialGradient id={`${id}-top`} cx="50%" cy="0%" r="65%">
          <stop offset="0%" stopColor="#EA4335" />
          <stop offset="60%" stopColor="#EA4335" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#EA4335" stopOpacity="0" />
        </radialGradient>

        {/* Right Lobe: Vibrant electric Google Blue */}
        <radialGradient id={`${id}-right`} cx="100%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="60%" stopColor="#1A73E8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#1A73E8" stopOpacity="0" />
        </radialGradient>

        {/* Bottom Lobe: Deep emerald Google Green */}
        <radialGradient id={`${id}-bottom`} cx="50%" cy="100%" r="65%">
          <stop offset="0%" stopColor="#1E8E3E" />
          <stop offset="60%" stopColor="#1E8E3E" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#1E8E3E" stopOpacity="0" />
        </radialGradient>

        {/* Left Lobe: Warm, saturated Golden Amber / Orange */}
        <radialGradient id={`${id}-left`} cx="0%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>

        {/* Luminous soft core transition */}
        <radialGradient id={`${id}-center`} cx="50%" cy="50%" r="32%">
          <stop offset="0%" stopColor="#8AB4F8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#4285F4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 100% opaque, high-saturation vector fill — bold and instantly recognizable */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="100" height="100" fill="#4285F4" />
        <rect width="100" height="100" fill={`url(#${id}-top)`} />
        <rect width="100" height="100" fill={`url(#${id}-right)`} />
        <rect width="100" height="100" fill={`url(#${id}-bottom)`} />
        <rect width="100" height="100" fill={`url(#${id}-left)`} />
        <circle cx="50" cy="50" r="32" fill={`url(#${id}-center)`} />
      </g>
    </svg>
  );
}
