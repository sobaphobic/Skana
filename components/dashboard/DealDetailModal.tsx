"use client";

import type { PipelineDeal, DealNote } from "@/lib/dealsSession";
import { formatIsoDateMedium } from "@/lib/formatDate";
import {
  formatGbpFromPence,
  parsePriceList,
  readPriceListRaw,
  subscribePriceList,
} from "@/lib/priceListSession";
import { lossReasonLabel } from "@/lib/lossReasons";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipelineStages";
import Link from "next/link";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

const selectClass = `${controlClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`;
const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
} as const;

function createDealNoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-n`;
}

function sortNotesChronological(notes: DealNote[]): DealNote[] {
  return [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function formatNoteWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DealDetailModal({
  deal,
  open,
  onClose,
  onSave,
}: {
  deal: PipelineDeal | null;
  open: boolean;
  onClose: () => void;
  onSave: (deal: PipelineDeal) => void;
}) {
  if (!open || !deal) return null;
  return (
    <DealDetailModalInner
      key={deal.id}
      deal={deal}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function DealDetailModalInner({
  deal,
  onClose,
  onSave,
}: {
  deal: PipelineDeal;
  onClose: () => void;
  onSave: (deal: PipelineDeal) => void;
}) {
  const priceListRaw = useSyncExternalStore(
    subscribePriceList,
    readPriceListRaw,
    () => null,
  );
  const priceList = useMemo(
    () => parsePriceList(priceListRaw),
    [priceListRaw],
  );

  const [draft, setDraft] = useState(() => ({
    ...deal,
    notes: [...deal.notes],
  }));
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saleNameId = useId();
  const nameId = useId();
  const emailId = useId();
  const dateId = useId();
  const productId = useId();
  const stageId = useId();
  const newNoteId = useId();

  const sortedNotes = useMemo(
    () => sortNotesChronological(draft.notes),
    [draft.notes],
  );

  const applyProduct = useCallback(
    (itemId: string) => {
      if (!itemId || !draft) return;
      const item = priceList.find((p) => p.id === itemId);
      if (!item) return;
      setDraft({
        ...draft,
        priceListItemId: item.id,
        productName: item.name,
        unitPricePence: item.unitPricePence,
      });
    },
    [draft, priceList],
  );

  const handleSave = () => {
    const sale = draft.saleName.trim();
    const name = draft.contactName.trim();
    const email = draft.contactEmail.trim();
    if (!sale) {
      setError("Sale name is required.");
      return;
    }
    if (!name) {
      setError("Contact name is required.");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Enter a valid contact email.");
      return;
    }
    if (!draft.productStartDate) {
      setError("Product start date is required.");
      return;
    }
    const productOk =
      priceList.some((p) => p.id === draft.priceListItemId) ||
      draft.productName.trim().length > 0;
    if (!productOk) {
      setError("Choose a product from the price list.");
      return;
    }

    let notes = draft.notes;
    const noteBody = newNote.trim();
    if (noteBody) {
      notes = [
        ...notes,
        {
          id: createDealNoteId(),
          body: noteBody,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    onSave({
      ...draft,
      saleName: sale,
      contactName: name,
      contactEmail: email,
      notes,
    });
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-detail-title"
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-crm-border bg-crm-main shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-crm-border/50 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="deal-detail-title"
              className="truncate text-lg font-semibold text-crm-cream"
            >
              {draft.saleName.trim() || "Deal"}
            </h2>
            <p className="mt-0.5 truncate text-sm text-crm-muted">
              {draft.productName}
              {draft.productName ? " · " : null}
              {draft.contactName} · {formatGbpFromPence(draft.unitPricePence)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-crm-muted transition hover:bg-white/10 hover:text-crm-cream"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-crm-muted">
            Edit deal
          </p>
          {draft.stageId === "closed_won" && !draft.paid ? (
            <p className="mb-4 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-crm-cream/95">
              <span className="font-medium text-amber-100/95">Awaiting payment.</span>{" "}
              Record payment in{" "}
              <Link
                href="/dashboard/current-users"
                className="font-semibold text-crm-cream underline-offset-2 hover:underline"
              >
                Current users
              </Link>
              .
            </p>
          ) : null}
          {draft.stageId === "closed_won" && draft.paid ? (
            <p className="mb-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/95">
              <span className="font-medium text-emerald-50/95">Payment recorded.</span>{" "}
              This deal no longer appears on the pipeline board — open{" "}
              <Link
                href="/dashboard/current-users"
                className="font-semibold text-crm-cream underline-offset-2 hover:underline"
              >
                Current users
              </Link>{" "}
              and check <span className="font-medium">Active</span>.
            </p>
          ) : null}
          {draft.stageId === "closed_lost" && draft.lossReason ? (
            <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-crm-cream/95">
              <p>
                <span className="font-medium text-red-100/95">Lost: </span>
                {lossReasonLabel(draft.lossReason)}
              </p>
              {draft.lossNote ? (
                <p className="mt-1 text-crm-muted">{draft.lossNote}</p>
              ) : null}
              <p className="mt-2 text-xs text-crm-muted">
                To bring this deal back, use{" "}
                <strong className="font-medium text-crm-cream/85">Return to pipeline</strong>{" "}
                on the lost deals page.
              </p>
              <Link
                href="/dashboard/pipeline/lost-deals"
                className="mt-1 inline-block text-xs font-semibold text-crm-cream underline-offset-2 hover:underline"
              >
                Open lost deals archive
              </Link>
            </div>
          ) : null}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={saleNameId}
                className="text-sm font-medium text-crm-cream/95"
              >
                Sale name
              </label>
              <input
                id={saleNameId}
                value={draft.saleName}
                onChange={(e) =>
                  setDraft({ ...draft, saleName: e.target.value })
                }
                className={controlClass}
                placeholder="Shown on the pipeline board"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameId} className="text-sm font-medium text-crm-cream/95">
                Contact name
              </label>
              <input
                id={nameId}
                value={draft.contactName}
                onChange={(e) =>
                  setDraft({ ...draft, contactName: e.target.value })
                }
                className={controlClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={emailId} className="text-sm font-medium text-crm-cream/95">
                Contact email
              </label>
              <input
                id={emailId}
                type="email"
                value={draft.contactEmail}
                onChange={(e) =>
                  setDraft({ ...draft, contactEmail: e.target.value })
                }
                className={controlClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={dateId} className="text-sm font-medium text-crm-cream/95">
                Product start date
              </label>
              <input
                id={dateId}
                type="date"
                value={draft.productStartDate}
                onChange={(e) =>
                  setDraft({ ...draft, productStartDate: e.target.value })
                }
                className={controlClass}
              />
              {draft.productStartDate ? (
                <p className="text-xs text-crm-muted">
                  {formatIsoDateMedium(draft.productStartDate)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={productId} className="text-sm font-medium text-crm-cream/95">
                Product (price list)
              </label>
              <select
                id={productId}
                value={
                  draft.priceListItemId &&
                  (priceList.some((p) => p.id === draft.priceListItemId) ||
                    Boolean(draft.productName))
                    ? draft.priceListItemId
                    : ""
                }
                onChange={(e) => applyProduct(e.target.value)}
                className={selectClass}
                style={selectChevron}
              >
                {priceList.length === 0 &&
                !draft.priceListItemId ? (
                  <option value="" className="bg-crm-bg text-crm-cream">
                    No products — add a price list item first
                  </option>
                ) : null}
                {draft.priceListItemId &&
                !priceList.some((p) => p.id === draft.priceListItemId) ? (
                  <option
                    value={draft.priceListItemId}
                    className="bg-crm-bg text-crm-cream"
                  >
                    {draft.productName} (removed from price list)
                  </option>
                ) : null}
                {priceList.length > 0 ? (
                  <>
                    <option value="" disabled className="bg-crm-bg text-crm-cream">
                      Select product
                    </option>
                    {priceList.map((p) => (
                      <option key={p.id} value={p.id} className="bg-crm-bg text-crm-cream">
                        {p.name} ({formatGbpFromPence(p.unitPricePence)})
                      </option>
                    ))}
                  </>
                ) : null}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={stageId} className="text-sm font-medium text-crm-cream/95">
                Stage
              </label>
              <select
                id={stageId}
                value={draft.stageId}
                onChange={(e) => {
                  const next = e.target.value as PipelineStageId;
                  setDraft({
                    ...draft,
                    stageId: next,
                    ...(next !== "closed_lost"
                      ? { lossReason: null, lossNote: "" }
                      : {}),
                  });
                }}
                className={selectClass}
                style={selectChevron}
              >
                {PIPELINE_STAGES.filter(
                  (s) =>
                    s.id !== "closed_lost" || draft.stageId === "closed_lost",
                ).map((s) => (
                  <option key={s.id} value={s.id} className="bg-crm-bg text-crm-cream">
                    {s.label}
                  </option>
                ))}
              </select>
              {draft.stageId !== "closed_lost" ? (
                <p className="text-xs text-crm-muted">
                  To mark as lost, drag the deal into{" "}
                  <strong className="font-medium text-crm-cream/80">Closed lost</strong>{" "}
                  on the pipeline board.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-crm-muted">
              Notes timeline
            </h3>
            {sortedNotes.length === 0 ? (
              <p className="mt-2 text-sm text-crm-muted">No notes yet.</p>
            ) : (
              <ul className="mt-3 space-y-3 border-l border-crm-border/60 pl-4">
                {sortedNotes.map((n) => (
                  <li key={n.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-crm-cream/50" />
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-crm-muted">
                      {formatNoteWhen(n.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-crm-cream/95">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor={newNoteId} className="text-sm font-medium text-crm-cream/95">
                Add to timeline
              </label>
              <textarea
                id={newNoteId}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="New note appears on save…"
                className={`${controlClass} min-h-[5rem] resize-y`}
              />
            </div>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-300/95" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-crm-border/50 px-5 py-4">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
