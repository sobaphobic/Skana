"use client";

import {
  appendManualContactHistory,
  parseManualContacts,
  readManualContactsRaw,
  subscribeManualContacts,
  updateManualContactFields,
  type ManualContact,
} from "@/lib/manualContactsSession";
import {
  appendPipelineContactHistory,
  getHistoryForPipelineKey,
  parsePipelineContactHistory,
  readPipelineContactHistoryRaw,
  subscribePipelineContactHistory,
} from "@/lib/pipelineContactHistorySession";
import { formatHistoryWhen } from "@/lib/contactHistory";
import type { PipelineDeal } from "@/lib/dealsSession";
import {
  dealsForPipelineContactKey,
  rollContacts,
  type RolledContact,
} from "@/lib/contactRollup";
import { formatIsoDateMedium } from "@/lib/formatDate";
import { formatGbpFromPence } from "@/lib/priceListSession";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipelineStages";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

export type ContactCardSelection =
  | { source: "pipeline"; rolled: RolledContact }
  | { source: "manual"; id: string };

function stageLabel(id: PipelineStageId): string {
  return PIPELINE_STAGES.find((s) => s.id === id)?.label ?? id;
}

function manualDisplayName(c: ManualContact): string {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return n || c.email;
}

function dealsMatchingManualEmail(
  deals: PipelineDeal[],
  email: string,
): PipelineDeal[] {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  return deals.filter((d) => d.contactEmail.trim().toLowerCase() === e);
}

function sortDealsForHistory(deals: PipelineDeal[]): PipelineDeal[] {
  return [...deals].sort((a, b) =>
    b.productStartDate.localeCompare(a.productStartDate),
  );
}

export function ContactCardModal({
  onClose,
  selection,
  allDeals,
}: {
  onClose: () => void;
  selection: ContactCardSelection;
  allDeals: PipelineDeal[];
}) {
  const manualRaw = useSyncExternalStore(
    subscribeManualContacts,
    readManualContactsRaw,
    () => null,
  );
  const manualContacts = useMemo(
    () => parseManualContacts(manualRaw),
    [manualRaw],
  );

  const pipelineHistRaw = useSyncExternalStore(
    subscribePipelineContactHistory,
    readPipelineContactHistoryRaw,
    () => null,
  );
  const pipelineHistoryStore = useMemo(
    () => parsePipelineContactHistory(pipelineHistRaw),
    [pipelineHistRaw],
  );

  const contact = useMemo(() => {
    if (selection.source !== "manual") return null;
    return manualContacts.find((c) => c.id === selection.id) ?? null;
  }, [manualContacts, selection]);

  const liveRolled = useMemo(() => {
    if (selection.source !== "pipeline") return null;
    return (
      rollContacts(allDeals).find((r) => r.key === selection.rolled.key) ??
      selection.rolled
    );
  }, [allDeals, selection]);

  const [historyTab, setHistoryTab] = useState<"contact" | "deal">("contact");
  const [newNote, setNewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [pipelineHintOpen, setPipelineHintOpen] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const firstId = useId();
  const lastId = useId();
  const phoneId = useId();
  const emailId = useId();
  const jobId = useId();
  const noteId = useId();

  useEffect(() => {
    if (selection.source === "manual" && !contact) {
      onClose();
    }
  }, [selection, contact, onClose]);

  const pipelineKey =
    selection.source === "pipeline" ? selection.rolled.key : null;
  const pipelineContactHistory = useMemo(() => {
    if (!pipelineKey) return [];
    return getHistoryForPipelineKey(pipelineHistoryStore, pipelineKey);
  }, [pipelineHistoryStore, pipelineKey]);

  /** Pipeline history keyed by email — merge into manual card so assign-deal notes stay visible. */
  const manualContactHistoryMerged = useMemo(() => {
    if (!contact) return [];
    const manualHistory = contact.history ?? [];
    const emailKey = `email:${contact.email.trim().toLowerCase()}`;
    const pipe = getHistoryForPipelineKey(pipelineHistoryStore, emailKey);
    const seen = new Set<string>();
    const merged = [...manualHistory, ...pipe].filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    return merged.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [contact, pipelineHistoryStore]);

  const dealRows = useMemo(() => {
    if (selection.source === "pipeline" && liveRolled) {
      return sortDealsForHistory(
        dealsForPipelineContactKey(allDeals, liveRolled.key),
      );
    }
    if (selection.source === "manual" && contact) {
      return sortDealsForHistory(dealsMatchingManualEmail(allDeals, contact.email));
    }
    return [];
  }, [selection, liveRolled, allDeals, contact]);

  const handleAddContactNote = useCallback(() => {
    const body = newNote.trim();
    if (!body) return;
    if (selection.source === "pipeline" && pipelineKey) {
      appendPipelineContactHistory(pipelineKey, body);
    } else if (selection.source === "manual" && contact) {
      appendManualContactHistory(contact.id, body);
    }
    setNewNote("");
  }, [newNote, selection, pipelineKey, contact]);

  const startEdit = useCallback(() => {
    if (!contact) return;
    setEditFirst(contact.firstName);
    setEditLast(contact.lastName);
    setEditPhone(contact.phone);
    setEditEmail(contact.email);
    setEditJob(contact.jobTitle);
    setEditError(null);
    setEditing(true);
  }, [contact]);

  const cancelEdit = useCallback(() => {
    if (contact) {
      setEditFirst(contact.firstName);
      setEditLast(contact.lastName);
      setEditPhone(contact.phone);
      setEditEmail(contact.email);
      setEditJob(contact.jobTitle);
    }
    setEditError(null);
    setEditing(false);
  }, [contact]);

  const submitEdit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contact) return;
    const first = editFirst.trim();
    const last = editLast.trim();
    const phone = editPhone.trim();
    const email = editEmail.trim();
    const job = editJob.trim();
    if (!first) {
      setEditError("First name is required.");
      return;
    }
    if (!last) {
      setEditError("Last name is required.");
      return;
    }
    if (!phone) {
      setEditError("Phone number is required.");
      return;
    }
    if (!email || !email.includes("@")) {
      setEditError("Enter a valid email address.");
      return;
    }
    if (!job) {
      setEditError("Job title is required.");
      return;
    }
    updateManualContactFields(contact.id, {
      firstName: first,
      lastName: last,
      phone,
      email,
      jobTitle: job,
    });
    setEditing(false);
    setEditError(null);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPipeline = selection.source === "pipeline";
  const rolled = isPipeline ? (liveRolled ?? selection.rolled) : null;

  const titleName =
    isPipeline && rolled
      ? rolled.contactName
      : contact
        ? manualDisplayName(contact)
        : "Contact";

  const subtitle = isPipeline
    ? "Customer · from pipeline"
    : contact?.kind === "customer"
      ? "Customer · added manually"
      : "Business contact";

  const displayEmail =
    isPipeline && rolled ? rolled.contactEmail : (contact?.email ?? "—");
  const displayPhone = isPipeline ? null : contact?.phone ?? null;
  const displayJob = isPipeline ? null : contact?.jobTitle ?? null;

  const contactHistoryEntries = isPipeline
    ? pipelineContactHistory
    : manualContactHistoryMerged;

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
        aria-labelledby="contact-card-title"
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-crm-border bg-crm-main shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-crm-border/50 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2
                id="contact-card-title"
                className="min-w-0 truncate text-lg font-semibold text-crm-cream"
              >
                {titleName}
              </h2>
              {!isPipeline && contact && !editing ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-crm-border/80 px-2.5 py-1 text-xs font-medium text-crm-cream transition hover:bg-white/5"
                  aria-label="Edit contact information"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Edit
                </button>
              ) : null}
              {isPipeline ? (
                <button
                  type="button"
                  onClick={() => setPipelineHintOpen((v) => !v)}
                  aria-expanded={pipelineHintOpen}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-crm-border/80 px-2.5 py-1 text-xs font-medium text-crm-cream transition hover:bg-white/5"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Edit
                </button>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-crm-muted">
              {subtitle}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isPipeline && pipelineHintOpen ? (
            <p className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-crm-cream/95">
              Name and email come from your pipeline deals. Open the{" "}
              <Link
                href="/dashboard/pipeline"
                className="font-semibold text-crm-cream underline-offset-2 hover:underline"
                onClick={onClose}
              >
                pipeline
              </Link>
              , select the deal, and edit the contact fields there.
            </p>
          ) : null}
          {!isPipeline && contact && editing ? (
            <form onSubmit={submitEdit} className="space-y-3">
              {editError ? (
                <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100/95">
                  {editError}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={firstId} className="text-xs font-medium text-crm-muted">
                    First name
                  </label>
                  <input
                    id={firstId}
                    value={editFirst}
                    onChange={(e) => {
                      setEditFirst(e.target.value);
                      setEditError(null);
                    }}
                    className={controlClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={lastId} className="text-xs font-medium text-crm-muted">
                    Last name
                  </label>
                  <input
                    id={lastId}
                    value={editLast}
                    onChange={(e) => {
                      setEditLast(e.target.value);
                      setEditError(null);
                    }}
                    className={controlClass}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor={phoneId} className="text-xs font-medium text-crm-muted">
                  Phone
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  value={editPhone}
                  onChange={(e) => {
                    setEditPhone(e.target.value);
                    setEditError(null);
                  }}
                  className={controlClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={emailId} className="text-xs font-medium text-crm-muted">
                  Email
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    setEditError(null);
                  }}
                  className={controlClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={jobId} className="text-xs font-medium text-crm-muted">
                  Job title
                </label>
                <input
                  id={jobId}
                  value={editJob}
                  onChange={(e) => {
                    setEditJob(e.target.value);
                    setEditError(null);
                  }}
                  className={controlClass}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  className="rounded-xl border border-crm-border/80 bg-crm-active/90 px-4 py-2 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-crm-border/80 px-4 py-2 text-sm font-medium text-crm-cream transition hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="space-y-3 rounded-xl border border-crm-border/60 bg-crm-elevated/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                      Email
                    </p>
                    {displayEmail && displayEmail !== "—" ? (
                      <a
                        href={`mailto:${displayEmail}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 block truncate text-sm text-crm-cream/90 underline-offset-2 hover:underline"
                      >
                        {displayEmail}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-sm text-crm-muted">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                      Phone
                    </p>
                    {displayPhone ? (
                      <a
                        href={`tel:${displayPhone.replace(/\s/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 block text-sm text-crm-cream/90 underline-offset-2 hover:underline"
                      >
                        {displayPhone}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-sm text-crm-muted">—</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                    Job title
                  </p>
                  <p className="mt-0.5 text-sm text-crm-cream/95">
                    {displayJob?.trim() ? displayJob : "—"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-crm-border/50 bg-crm-bg/25 px-5 pb-4 pt-3">
          <div
            className="mb-3 inline-flex rounded-xl border border-crm-border/80 bg-crm-bg/35 p-1"
            role="tablist"
            aria-label="History"
          >
            <button
              type="button"
              role="tab"
              aria-selected={historyTab === "contact"}
              onClick={() => setHistoryTab("contact")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                historyTab === "contact"
                  ? "bg-crm-active/90 text-crm-cream shadow-sm"
                  : "text-crm-muted hover:text-crm-cream"
              }`}
            >
              Contact history
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={historyTab === "deal"}
              onClick={() => setHistoryTab("deal")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                historyTab === "deal"
                  ? "bg-crm-active/90 text-crm-cream shadow-sm"
                  : "text-crm-muted hover:text-crm-cream"
              }`}
            >
              Deal history
            </button>
          </div>

          {historyTab === "contact" ? (
            <div className="flex max-h-[min(42vh,300px)] flex-col gap-3 overflow-hidden">
              <div className="shrink-0 space-y-2 border-b border-crm-border/40 pb-3">
                <label htmlFor={noteId} className="text-xs font-medium text-crm-muted">
                  Add note
                </label>
                <textarea
                  id={noteId}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  placeholder="Call summary, follow-up, context…"
                  className={`${controlClass} resize-none`}
                />
                <button
                  type="button"
                  onClick={handleAddContactNote}
                  disabled={!newNote.trim()}
                  className="rounded-lg border border-crm-border/80 bg-crm-active/80 px-3 py-1.5 text-xs font-semibold text-crm-cream transition hover:bg-crm-active disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to history
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                  Previous notes
                </p>
                {contactHistoryEntries.length === 0 ? (
                  <p className="text-sm text-crm-muted">No notes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {contactHistoryEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-crm-border/40 bg-crm-elevated/15 px-3 py-2"
                      >
                        <p className="text-[0.65rem] text-crm-muted">
                          {formatHistoryWhen(entry.createdAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-crm-cream/95">
                          {entry.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[260px] overflow-x-auto overflow-y-auto">
              {dealRows.length === 0 ? (
                <p className="text-sm text-crm-muted">
                  No deals linked to this contact yet.
                </p>
              ) : (
                <table className="w-full min-w-[28rem] text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-crm-border/40 text-crm-muted">
                      <th className="py-2 pr-2 font-semibold">Sale</th>
                      <th className="py-2 pr-2 font-semibold">Product</th>
                      <th className="py-2 pr-2 font-semibold">Stage</th>
                      <th className="py-2 pr-2 font-semibold">Start</th>
                      <th className="py-2 text-right font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-crm-border/30">
                    {dealRows.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-2 font-medium text-crm-cream">
                          {d.saleName}
                        </td>
                        <td className="max-w-[8rem] truncate py-2 pr-2 text-crm-muted">
                          {d.productName || "—"}
                        </td>
                        <td className="py-2 pr-2 text-crm-muted">
                          <span className="inline-flex flex-wrap gap-1">
                            {stageLabel(d.stageId)}
                            {d.stageId === "closed_won" && d.paid ? (
                              <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[0.6rem] font-semibold text-emerald-100">
                                Paid
                              </span>
                            ) : null}
                            {d.stageId === "closed_lost" ? (
                              <span className="rounded bg-red-500/20 px-1 py-0.5 text-[0.6rem] font-semibold text-red-100">
                                Lost
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-crm-muted">
                          {d.productStartDate
                            ? formatIsoDateMedium(d.productStartDate)
                            : "—"}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums text-crm-cream">
                          {formatGbpFromPence(d.unitPricePence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
