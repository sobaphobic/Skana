"use client";

import { AuthFlowShell } from "@/components/AuthFlowShell";
import { BrandLogo } from "@/components/BrandLogo";
import { Building2, UsersRound } from "lucide-react";
import Link from "next/link";
import {
  parseOnboardingProfile,
  readOnboardingProfileRaw,
  signedUpAsLabel,
} from "@/lib/skanaSession";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";

export default function CompanyChoicePage() {
  const router = useRouter();
  const profileRaw = useSyncExternalStore(
    () => () => {},
    readOnboardingProfileRaw,
    () => null,
  );
  const signedUpAs = useMemo(
    () => signedUpAsLabel(parseOnboardingProfile(profileRaw)),
    [profileRaw],
  );

  return (
    <AuthFlowShell
      header={
        <header className="mb-12 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" priority />
          <p className="max-w-[280px] text-sm leading-relaxed text-crm-muted">
            You&apos;re almost there—connect your account to a company workspace.
          </p>
          {signedUpAs ? (
            <p className="text-xs text-crm-muted">
              Signed up as{" "}
              <span className="font-medium text-crm-cream">{signedUpAs}</span>
            </p>
          ) : null}
        </header>
      }
    >
      <div className="rounded-2xl border border-crm-border bg-crm-elevated/75 p-4 shadow-lg backdrop-blur-sm sm:p-5">
        <div className="mb-6 border-b border-crm-border/60 pb-5 text-center">
          <h1 className="text-base font-semibold text-crm-cream">
            Company setup
          </h1>
          <p className="mt-1 text-sm text-crm-muted">
            Choose how you&apos;d like to get started.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="group flex w-full items-start gap-3 rounded-xl border border-crm-border bg-crm-bg/35 px-4 py-4 text-left text-crm-cream transition hover:border-crm-cream/35 hover:bg-crm-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-cream/30 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-elevated"
            onClick={() => router.push("/onboarding/company/create")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-crm-bg/60 text-crm-cream ring-1 ring-crm-border/80">
              <Building2 className="h-5 w-5" aria-hidden strokeWidth={2} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-semibold">
                Set up a new company
              </span>
              <span className="mt-0.5 block text-sm text-crm-muted group-hover:text-crm-cream/85">
                Create a workspace for your team. You&apos;ll name it next.
              </span>
            </span>
          </button>

          <button
            type="button"
            className="group flex w-full items-start gap-3 rounded-xl border border-crm-border bg-crm-bg/35 px-4 py-4 text-left text-crm-cream transition hover:border-crm-cream/35 hover:bg-crm-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-cream/30 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-elevated"
            onClick={() => router.push("/onboarding/company/join")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-crm-bg/60 text-crm-cream ring-1 ring-crm-border/80">
              <UsersRound className="h-5 w-5" aria-hidden strokeWidth={2} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-semibold">
                Join an existing company
              </span>
              <span className="mt-0.5 block text-sm text-crm-muted group-hover:text-crm-cream/85">
                Use an invite from a teammate or admin when you have one.
              </span>
            </span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-crm-muted">
          Wrong account?{" "}
          <Link
            href="/login"
            className="font-medium text-crm-cream underline-offset-2 hover:underline"
          >
            Back to log in
          </Link>
        </p>
      </div>
    </AuthFlowShell>
  );
}
