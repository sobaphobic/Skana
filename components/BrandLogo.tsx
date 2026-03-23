"use client";

import Image from "next/image";

/** Single source for the SkAna mark — use everywhere we show branding. */
export const BRAND_LOGO_SRC = "/skana-logo.png";
export const BRAND_LOGO_WIDTH = 949;
export const BRAND_LOGO_HEIGHT = 1024;

const sizeClass: Record<"xs" | "sm" | "md" | "lg", string> = {
  xs: "max-w-[76px]",
  sm: "max-w-[140px]",
  md: "max-w-[220px]",
  lg: "max-w-[300px]",
};

export function BrandLogo({
  size = "md",
  className = "",
  priority = false,
}: {
  size?: keyof typeof sizeClass;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt="SkAna"
      width={BRAND_LOGO_WIDTH}
      height={BRAND_LOGO_HEIGHT}
      priority={priority}
      className={`h-auto w-full select-none ${sizeClass[size]} ${className}`.trim()}
    />
  );
}
