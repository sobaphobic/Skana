"use client";

import {
  groupLostDealsByReason,
  parseDeals,
  readDeals,
  readDealsRaw,
  reinstateLostDeal,
  saveDeals,
  subscribeDeals,
} from "@/lib/dealsSession";
import { formatGbpFromPence } from "@/lib/priceListSession";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";

export default function LostDealsPage() {
  const dealsRaw = useSyncExternalStore(
    subscribeDeals,
    readDealsRaw,
    () => null,
  );
  const deals = useMemo(() => parseDeals(dealsRaw), [dealsRaw]);
  const grouped = useMemo(() => groupLostDealsByReason(deals), [deals]);

  const returnToPipeline = useCallback((dealId: string) => {
    const all = readDeals();
    saveDeals(reinstateLostDeal(all, dealId));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-8">
      <div>
        <Link
          href="/dashboard/pipeline"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-crm-muted transition hover:text-crm-cream"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Back to pipeline
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-crm-cream">
          Lost deals
        </h1>
        <p className="mt-1 text-sm text-crm-muted">
          Archived when moved to <strong className="font-medium text-crm-cream/90">Closed lost</strong>{" "}
          on the board. Grouped by reason.
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-crm-border bg-crm-elevated/20 px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-crm-muted">
            No lost deals yet. Drag a card into Closed lost on the{" "}
            <Link
              href="/dashboard/pipeline"
              className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
            >
              pipeline
            </Link>{" "}
            to record one.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.reasonId}>
              <h2 className="border-b border-crm-border/50 pb-2 text-sm font-semibold uppercase tracking-wide text-crm-muted">
                {group.label}
                <span className="ml-2 font-normal normal-case text-crm-muted">
                  ({group.deals.length})
                </span>
              </h2>
              <ul className="mt-4 space-y-3">
                {group.deals.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-4 rounded-2xl border border-crm-border bg-crm-elevated/20 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-crm-cream">{d.saleName}</p>
                      <p className="mt-0.5 text-sm text-crm-muted">
                        {d.contactName}
                        {d.contactEmail ? ` · ${d.contactEmail}` : null}
                      </p>
                      <p className="mt-1 text-sm text-crm-cream/90">
                        {d.productName}
                        <span className="text-crm-border"> · </span>
                        <span className="font-semibold tabular-nums">
                          {formatGbpFromPence(d.unitPricePence)}
                        </span>
                      </p>
                      {d.lossNote ? (
                        <p className="mt-2 border-l-2 border-crm-border/70 pl-3 text-sm text-crm-muted">
                          {d.lossNote}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => returnToPipeline(d.id)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/10"
                    >
                      <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Return to pipeline
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
