"use client";

import type { PipelineDeal } from "@/lib/dealsSession";
import { LOSS_REASONS, type LossReasonId } from "@/lib/lossReasons";
import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

const selectClass = `${controlClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`;
const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
} as const;

export function LossReasonModal({
  deal,
  open,
  onClose,
  onConfirm,
}: {
  deal: PipelineDeal | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: LossReasonId, note: string) => void;
}) {
  if (!open || !deal) return null;
  return (
    <LossReasonModalInner
      key={deal.id}
      deal={deal}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function LossReasonModalInner({
  deal,
  onClose,
  onConfirm,
}: {
  deal: PipelineDeal;
  onClose: () => void;
  onConfirm: (reason: LossReasonId, note: string) => void;
}) {
  const [reason, setReason] = useState<LossReasonId>(LOSS_REASONS[0]!.id);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const noteId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!reason) {
      setError("Choose a reason for the loss.");
      return;
    }
    setError(null);
    onConfirm(reason, note.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loss-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-crm-border bg-crm-main shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-crm-border/50 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="loss-modal-title"
              className="text-lg font-semibold text-crm-cream"
            >
              Reason for loss
            </h2>
            <p className="mt-1 truncate text-sm text-crm-muted">
              {deal.saleName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-crm-muted transition hover:bg-white/10 hover:text-crm-cream"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={reasonId}
              className="text-sm font-medium text-crm-cream/95"
            >
              Why was this deal lost?
            </label>
            <select
              id={reasonId}
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as LossReasonId)
              }
              className={selectClass}
              style={selectChevron}
            >
              {LOSS_REASONS.map((r) => (
                <option key={r.id} value={r.id} className="bg-crm-bg text-crm-cream">
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={noteId}
              className="text-sm font-medium text-crm-cream/95"
            >
              Note{" "}
              <span className="font-normal text-crm-muted">(optional)</span>
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Extra context…"
              className={`${controlClass} min-h-[4.5rem] resize-y`}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-300/95" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-crm-border/50 px-5 py-4">
          <button
            type="button"
            onClick={submit}
            className="rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
          >
            Confirm lost
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
