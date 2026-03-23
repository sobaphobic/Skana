export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="text-foreground flex min-h-full flex-1 bg-crm-bg">
      {children}
    </div>
  );
}
