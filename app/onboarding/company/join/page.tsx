"use client";

import { FormField, PrimarySubmitButton } from "@/components/auth-forms";
import { AuthFlowShell } from "@/components/AuthFlowShell";
import { BrandLogo } from "@/components/BrandLogo";
import { joinCompanyByInviteCode } from "@/lib/skanaSession";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinCompanyPage() {
  const router = useRouter();
  const [joinError, setJoinError] = useState<string | null>(null);

  return (
    <AuthFlowShell
      maxWidthClass="max-w-[420px]"
      header={
        <header className="mb-12 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" priority />
          <p className="max-w-[300px] text-sm leading-relaxed text-crm-muted">
            Enter the login code from your company admin (Company → Company
            login code) to link your profile to their workspace.
          </p>
        </header>
      }
    >
      <div className="rounded-2xl border border-crm-border bg-crm-elevated/75 p-4 shadow-lg backdrop-blur-sm sm:p-5">
        <div className="mb-6 border-b border-crm-border/60 pb-5 text-center">
          <h1 className="text-base font-semibold text-crm-cream">
            Join existing company
          </h1>
          <p className="mt-1 text-sm text-crm-muted">
            Codes are checked on this device (saved when the workspace was set
            up). A server will validate joins in production.
          </p>
        </div>

        <form
          className="flex flex-col gap-4 px-0.5"
          onSubmit={(e) => {
            e.preventDefault();
            setJoinError(null);
            const fd = new FormData(e.currentTarget);
            const raw = String(fd.get("company_login_code") ?? "").trim();
            const result = joinCompanyByInviteCode(raw);
            if (!result.ok) {
              setJoinError(result.error);
              return;
            }
            router.push("/dashboard");
          }}
        >
          {joinError ? (
            <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100/95">
              {joinError}
            </p>
          ) : null}
          <FormField
            id="company_login_code"
            name="company_login_code"
            label="Company login code"
            autoComplete="off"
            placeholder="e.g. SKANA-X4K2-P8M1"
          />

          <PrimarySubmitButton>Join company</PrimarySubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-crm-muted">
          <Link
            href="/onboarding/company"
            className="font-medium text-crm-cream underline-offset-2 hover:underline"
          >
            ← Back to company choice
          </Link>
        </p>
      </div>
    </AuthFlowShell>
  );
}
