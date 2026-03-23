"use client";

import { DealDetailModal } from "@/components/dashboard/DealDetailModal";
import { LossReasonModal } from "@/components/dashboard/LossReasonModal";
import {
  PipelineBoardHeader,
  PipelineKpiStrip,
} from "@/components/dashboard/PipelineBoard";
import type { PipelineDeal } from "@/lib/dealsSession";
import {
  closedLostDeals,
  computeKpis,
  dealsVisibleOnKanban,
  parseDeals,
  readDealsRaw,
  saveDeals,
  subscribeDeals,
} from "@/lib/dealsSession";
import type { LossReasonId } from "@/lib/lossReasons";
import { formatGbpFromPence } from "@/lib/priceListSession";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipelineStages";
import { ChevronRight, ClipboardList, GripVertical } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const DRAG_MIME = "application/x-skana-deal-id";

export function PipelineKanbanBoard() {
  const dealsRaw = useSyncExternalStore(
    subscribeDeals,
    readDealsRaw,
    () => null,
  );
  const deals = useMemo(() => parseDeals(dealsRaw), [dealsRaw]);
  const boardDeals = useMemo(() => dealsVisibleOnKanban(deals), [deals]);

  const [selected, setSelected] = useState<PipelineDeal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lossDeal, setLossDeal] = useState<PipelineDeal | null>(null);

  const persist = useCallback((next: PipelineDeal[]) => {
    saveDeals(next);
  }, []);

  const { openTotal, wonTotal, paidThisYearPence, kpiYear } =
    computeKpis(deals);
  const lostList = useMemo(() => closedLostDeals(deals), [deals]);

  const columnCounts: Record<string, number> = {};
  const columnValues: Record<string, string> = {};
  for (const stage of PIPELINE_STAGES) {
    if (stage.id === "closed_lost") {
      columnCounts[stage.id] = lostList.length;
      const sum = lostList.reduce((a, d) => a + d.unitPricePence, 0);
      columnValues[stage.id] = formatGbpFromPence(sum);
    } else {
      const inStage = boardDeals.filter((d) => d.stageId === stage.id);
      columnCounts[stage.id] = inStage.length;
      const sum = inStage.reduce((a, d) => a + d.unitPricePence, 0);
      columnValues[stage.id] = formatGbpFromPence(sum);
    }
  }

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData(DRAG_MIME, dealId);
    e.dataTransfer.setData("text/plain", dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: PipelineStageId) => {
    e.preventDefault();
    const dealId =
      e.dataTransfer.getData(DRAG_MIME) ||
      e.dataTransfer.getData("text/plain");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    if (stageId === "closed_lost") {
      setLossDeal(deal);
      return;
    }

    const next = deals.map((d) =>
      d.id === dealId ? { ...d, stageId } : d,
    );
    persist(next);
  };

  const confirmLoss = useCallback(
    (reason: LossReasonId, note: string) => {
      if (!lossDeal) return;
      const next = deals.map((d) =>
        d.id === lossDeal.id
          ? {
              ...d,
              stageId: "closed_lost" as const,
              lossReason: reason,
              lossNote: note,
            }
          : d,
      );
      persist(next);
      setLossDeal(null);
    },
    [deals, lossDeal, persist],
  );

  const openDeal = (deal: PipelineDeal) => {
    setSelected(deal);
    setModalOpen(true);
  };

  const handleSaveDeal = (updated: PipelineDeal) => {
    const next = deals.map((d) => (d.id === updated.id ? updated : d));
    persist(next);
  };

  const dealForModal =
    modalOpen && selected
      ? (deals.find((d) => d.id === selected.id) ?? selected)
      : null;

  return (
    <div className="space-y-8">
      <PipelineBoardHeader dealCount={boardDeals.length} />
      <PipelineKpiStrip
        openTotalPence={openTotal}
        wonTotalPence={wonTotal}
        paidThisYearPence={paidThisYearPence}
        kpiYear={kpiYear}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_STAGES.map((stage) => {
          const inStage =
            stage.id === "closed_lost"
              ? []
              : boardDeals.filter((d) => d.stageId === stage.id);
          return (
            <article
              key={stage.id}
              className={`flex min-h-[17rem] flex-col overflow-hidden rounded-2xl border border-crm-border bg-crm-elevated/20 shadow-sm ${stage.topBarClass}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="flex items-start justify-between gap-2 border-b border-crm-border/40 px-4 py-3">
                {stage.id === "closed_lost" ? (
                  <Link
                    href="/dashboard/pipeline/lost-deals"
                    className="group inline-flex items-center gap-1 rounded-lg py-0.5 pr-1 text-sm font-semibold text-crm-cream outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-crm-cream/35"
                  >
                    {stage.label}
                    <ChevronRight
                      className="h-4 w-4 text-crm-muted transition group-hover:translate-x-0.5 group-hover:text-crm-cream"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </Link>
                ) : (
                  <h2 className="text-sm font-semibold text-crm-cream">
                    {stage.label}
                  </h2>
                )}
                <div className="text-right text-xs text-crm-muted">
                  <p className="font-medium text-crm-cream/90">
                    {columnCounts[stage.id] ?? 0}
                  </p>
                  <p>{columnValues[stage.id] ?? "£0.00"}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                {stage.id === "closed_lost" ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-8">
                    <p className="max-w-[16rem] text-center text-sm leading-relaxed text-crm-muted">
                      Drop a deal here to record why it was lost. It is archived
                      and removed from the board until you reinstate it.
                    </p>
                    <Link
                      href="/dashboard/pipeline/lost-deals"
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-white/35 bg-white px-5 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
                    >
                      <ClipboardList className="h-4 w-4" strokeWidth={2} aria-hidden />
                      View lost deals
                    </Link>
                  </div>
                ) : inStage.length === 0 ? (
                  <p className="py-6 text-center text-sm text-crm-muted">
                    Drop deals here
                  </p>
                ) : (
                  inStage.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex gap-1 rounded-xl border border-crm-border/70 bg-crm-bg/35 shadow-sm"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded-l-xl border-r border-crm-border/50 px-1.5 text-crm-muted hover:bg-white/5 active:cursor-grabbing"
                        aria-label={`Drag ${deal.saleName} to another stage`}
                      >
                        <GripVertical className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <button
                        type="button"
                        onClick={() => openDeal(deal)}
                        className="min-w-0 flex-1 px-3 py-2 text-left transition hover:bg-white/5"
                      >
                        <p className="truncate text-sm font-medium text-crm-cream">
                          {deal.saleName}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs text-crm-muted">
                            {deal.productName}
                          </p>
                          <p className="shrink-0 text-xs font-semibold tabular-nums text-crm-cream/90">
                            {formatGbpFromPence(deal.unitPricePence)}
                          </p>
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>

      <DealDetailModal
        deal={dealForModal}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        onSave={handleSaveDeal}
      />

      <LossReasonModal
        deal={lossDeal}
        open={lossDeal !== null}
        onClose={() => setLossDeal(null)}
        onConfirm={confirmLoss}
      />
    </div>
  );
}
