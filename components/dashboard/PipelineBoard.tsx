"use client";

import { formatGbpFromPence } from "@/lib/priceListSession";
import { Banknote, List, Plus } from "lucide-react";
import Link from "next/link";

export { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipelineStages";

export function PipelineBoardHeader({
  dealCount,
}: {
  dealCount: number;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-crm-cream">
          Sales Pipeline
        </h1>
        <span className="text-sm text-crm-muted">{dealCount} deals</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/pipeline/price-list"
          aria-label="Open price list"
          className="flex items-center gap-2 rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/5"
        >
          <List className="h-4 w-4" strokeWidth={2} aria-hidden />
          Price list
        </Link>
        <Link
          href="/dashboard/pipeline/new-deal"
          aria-label="Create new deal"
          className="flex items-center gap-2 rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          New Deal
        </Link>
      </div>
    </header>
  );
}

export function PipelineKpiStrip({
  openTotalPence,
  wonTotalPence,
  paidThisYearPence,
  kpiYear,
}: {
  openTotalPence: number;
  wonTotalPence: number;
  paidThisYearPence: number;
  kpiYear: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-2xl border border-crm-border bg-crm-elevated/30 px-4 py-4 shadow-sm">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200">
          <span className="text-lg font-semibold" aria-hidden>
            £
          </span>
        </span>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
            Total pipeline
          </p>
          <p className="text-lg font-semibold text-crm-cream">
            {formatGbpFromPence(openTotalPence)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-crm-border bg-crm-elevated/30 px-4 py-4 shadow-sm">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
          <span className="text-lg font-semibold" aria-hidden>
            £
          </span>
        </span>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
            Closed won
          </p>
          <p className="text-lg font-semibold text-crm-cream">
            {formatGbpFromPence(wonTotalPence)}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-crm-muted">On pipeline</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-crm-border bg-crm-elevated/30 px-4 py-4 shadow-sm">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-400/20 text-teal-100">
          <Banknote className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
            Total paid this year
          </p>
          <p
            className="text-lg font-semibold text-crm-cream"
            suppressHydrationWarning
          >
            {formatGbpFromPence(paidThisYearPence)}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-crm-muted">
            Calendar {kpiYear} · resets 1 Jan {kpiYear + 1}
          </p>
        </div>
      </div>
    </div>
  );
}
