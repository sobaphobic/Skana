"use client";

import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { TeamMessagesPanel } from "@/components/dashboard/TeamMessagesPanel";
import { formatLongDateWithWeekday } from "@/lib/formatDate";
import {
  parseDeals,
  readDealsRaw,
  subscribeDeals,
  unpaidClosedWonDeals,
} from "@/lib/dealsSession";
import {
  formatWelcomeDisplayName,
  parseOnboardingProfile,
  readOnboardingProfileRaw,
} from "@/lib/skanaSession";
import type { LucideIcon } from "lucide-react";
import { PoundSterling, UserCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

export default function DashboardPage() {
  const profileRaw = useSyncExternalStore(
    () => () => {},
    readOnboardingProfileRaw,
    () => null,
  );

  const profile = useMemo(
    () => parseOnboardingProfile(profileRaw),
    [profileRaw],
  );

  const today = formatLongDateWithWeekday(new Date());

  const displayName = formatWelcomeDisplayName(profile);

  const dealsRaw = useSyncExternalStore(
    subscribeDeals,
    readDealsRaw,
    () => null,
  );
  const deals = useMemo(() => parseDeals(dealsRaw), [dealsRaw]);
  const awaitingPayment = useMemo(
    () => unpaidClosedWonDeals(deals),
    [deals],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-crm-cream">
          Welcome back, {displayName}!{" "}
          <span className="font-normal" aria-hidden>
            👋
          </span>
        </h2>
        <p className="mt-1 text-sm text-crm-muted" suppressHydrationWarning>
          {today}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          href="/dashboard/pipeline"
          icon={PoundSterling}
          iconBg="bg-emerald-500/20 text-emerald-200"
          title="Active Pipeline"
          value="£0"
          subtitle="0 deals"
        />
        <StatCard
          href="/dashboard/current-users"
          icon={UserCircle}
          iconBg="bg-indigo-500/20 text-indigo-200"
          title="Current Users"
          value={String(awaitingPayment.length)}
          subtitle="Closed won · awaiting payment"
        />
      </div>

      <DashboardCalendar />

      <TeamMessagesPanel />
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  iconBg,
  title,
  value,
  subtitle,
}: {
  href?: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  value: string;
  subtitle: string;
}) {
  const body = (
    <div className="flex items-center gap-3 rounded-2xl border border-crm-border bg-crm-elevated/30 px-4 py-4 shadow-sm transition group-hover:border-crm-cream/25">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-crm-muted">{title}</p>
        <p className="truncate text-lg font-semibold text-crm-cream">
          {value}
        </p>
        <p className="text-xs text-crm-muted/90">{subtitle}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`Open ${title}`}
        className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-crm-cream/40"
      >
        {body}
      </Link>
    );
  }

  return body;
}
