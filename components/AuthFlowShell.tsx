import type { ReactNode } from "react";

export function AuthFlowShell({
  header,
  children,
  maxWidthClass = "max-w-[420px]",
}: {
  header: ReactNode;
  children: ReactNode;
  /** Tailwind max-width classes for the content column (e.g. max-w-lg). */
  maxWidthClass?: string;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in oklab, #f2e8cf 14%, transparent), transparent)",
        }}
      />
      <div className={`relative w-full ${maxWidthClass}`}>
        {header}
        {children}
      </div>
    </div>
  );
}
