"use client";

import type { PipelineDeal } from "@/lib/dealsSession";
import {
  parseDeals,
  readDeals,
  readDealsRaw,
  saveDeals,
  subscribeDeals,
} from "@/lib/dealsSession";
import { rollContacts } from "@/lib/contactRollup";
import {
  appendManualContact,
  appendManualContactHistory,
  parseManualContacts,
  readManualContactsRaw,
  subscribeManualContacts,
  type ManualContact,
} from "@/lib/manualContactsSession";
import { appendPipelineContactHistory } from "@/lib/pipelineContactHistorySession";
import {
  formatGbpFromPence,
  parsePriceList,
  readPriceListRaw,
  subscribePriceList,
} from "@/lib/priceListSession";
import { ArrowLeft, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

const selectClass = `${controlClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`;
const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
} as const;

function newDealId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-d`;
}

function newNoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-n`;
}

function manualDisplayName(c: ManualContact): string {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return n || c.email;
}

function dealHistoryLine(saleName: string, productName: string): string {
  return `Deal added: “${saleName}” · ${productName}`;
}

type LinkMode = "create" | "assign";

type AssignPick =
  | { source: "manual"; id: string }
  | { source: "pipeline"; key: string };

type AssignRow = {
  pick: AssignPick;
  label: string;
  sub: string;
  email: string;
  haystack: string;
};

export default function NewDealPage() {
  const router = useRouter();
  const priceListRaw = useSyncExternalStore(
    subscribePriceList,
    readPriceListRaw,
    () => null,
  );
  const priceList = useMemo(
    () => parsePriceList(priceListRaw),
    [priceListRaw],
  );

  const dealsRaw = useSyncExternalStore(
    subscribeDeals,
    readDealsRaw,
    () => null,
  );
  const deals = useMemo(() => parseDeals(dealsRaw), [dealsRaw]);

  const manualRaw = useSyncExternalStore(
    subscribeManualContacts,
    readManualContactsRaw,
    () => null,
  );
  const manualContacts = useMemo(
    () => parseManualContacts(manualRaw),
    [manualRaw],
  );

  const [linkMode, setLinkMode] = useState<LinkMode>("create");
  const [createFirst, setCreateFirst] = useState("");
  const [createLast, setCreateLast] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createJob, setCreateJob] = useState("");
  const [assignQuery, setAssignQuery] = useState("");
  const [assignPick, setAssignPick] = useState<AssignPick | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saleNameId = useId();
  const dateId = useId();
  const productId = useId();
  const notesId = useId();
  const cfId = useId();
  const clId = useId();
  const cpId = useId();
  const ceId = useId();
  const cjId = useId();
  const assignSearchId = useId();

  const manualEmailsLower = useMemo(
    () =>
      new Set(
        manualContacts
          .map((c) => c.email.trim().toLowerCase())
          .filter(Boolean),
      ),
    [manualContacts],
  );

  const assignRows = useMemo((): AssignRow[] => {
    const rows: AssignRow[] = [];
    for (const c of manualContacts) {
      const label = manualDisplayName(c);
      const sub =
        c.kind === "customer" ? "Saved customer" : "Business contact";
      rows.push({
        pick: { source: "manual", id: c.id },
        label,
        sub,
        email: c.email,
        haystack: `${label} ${c.email} ${c.phone} ${c.jobTitle}`.toLowerCase(),
      });
    }
    for (const r of rollContacts(deals)) {
      if (!r.contactEmail || r.contactEmail === "—") continue;
      const em = r.contactEmail.trim().toLowerCase();
      if (manualEmailsLower.has(em)) continue;
      rows.push({
        pick: { source: "pipeline", key: r.key },
        label: r.contactName,
        sub: "From pipeline",
        email: r.contactEmail,
        haystack:
          `${r.contactName} ${r.contactEmail} ${r.deals.map((d) => d.saleName).join(" ")}`.toLowerCase(),
      });
    }
    const q = assignQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.haystack.includes(q))
      : rows;
    return filtered.sort((a, b) => {
      const pri = (r: AssignRow) =>
        r.pick.source === "manual" ? 0 : 1;
      const pa = pri(a);
      const pb = pri(b);
      if (pa !== pb) return pa - pb;
      return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
    });
  }, [manualContacts, deals, assignQuery, manualEmailsLower]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const saleName = String(fd.get("sale_name") ?? "").trim();
    const productStartDate = String(fd.get("product_start_date") ?? "").trim();
    const productKey = String(fd.get("product_id") ?? "").trim();
    const notesRaw = String(fd.get("notes") ?? "").trim();

    if (!saleName) {
      setError("Sale name is required.");
      return;
    }
    if (!productStartDate) {
      setError("Product start date is required.");
      return;
    }
    if (!productKey) {
      setError("Choose a product from the price list.");
      return;
    }
    const item = priceList.find((p) => p.id === productKey);
    if (!item) {
      setError("Selected product was not found. Refresh or pick again.");
      return;
    }

    let contactName: string;
    let contactEmail: string;

    if (linkMode === "create") {
      const first = createFirst.trim();
      const last = createLast.trim();
      const phone = createPhone.trim();
      const email = createEmail.trim();
      const job = createJob.trim();
      if (!first) {
        setError("First name is required.");
        return;
      }
      if (!last) {
        setError("Last name is required.");
        return;
      }
      if (!phone) {
        setError("Phone number is required.");
        return;
      }
      if (!email || !email.includes("@")) {
        setError("Enter a valid contact email.");
        return;
      }
      if (!job) {
        setError("Job title is required.");
        return;
      }
      const emailLower = email.toLowerCase();
      const inManual = manualContacts.some(
        (c) => c.email.trim().toLowerCase() === emailLower,
      );
      const onPipeline = deals.some(
        (d) => d.contactEmail.trim().toLowerCase() === emailLower,
      );
      if (inManual || onPipeline) {
        setError(
          "This email is already used by a saved contact or a pipeline deal. Use Assign to existing contact instead.",
        );
        return;
      }
      contactName = `${first} ${last}`.trim();
      contactEmail = email;

      const newId = appendManualContact({
        kind: "customer",
        firstName: first,
        lastName: last,
        phone,
        email,
        jobTitle: job,
      });
      appendManualContactHistory(
        newId,
        dealHistoryLine(saleName, item.name),
      );
    } else {
      if (!assignPick) {
        setError("Search and select a contact to assign this deal to.");
        return;
      }
      if (assignPick.source === "manual") {
        const c = manualContacts.find((x) => x.id === assignPick.id);
        if (!c) {
          setError("That contact no longer exists. Pick another.");
          return;
        }
        contactName = manualDisplayName(c);
        contactEmail = c.email.trim();
        appendManualContactHistory(
          assignPick.id,
          dealHistoryLine(saleName, item.name),
        );
      } else {
        const rolled = rollContacts(readDeals()).find(
          (r) => r.key === assignPick.key,
        );
        if (!rolled || !rolled.contactEmail || rolled.contactEmail === "—") {
          setError("That pipeline contact no longer exists. Pick another.");
          return;
        }
        contactName = rolled.contactName;
        contactEmail = rolled.contactEmail.trim();
        appendPipelineContactHistory(
          assignPick.key,
          dealHistoryLine(saleName, item.name),
        );
      }
    }

    const notes =
      notesRaw.length > 0
        ? [
            {
              id: newNoteId(),
              body: notesRaw,
              createdAt: new Date().toISOString(),
            },
          ]
        : [];

    const deal: PipelineDeal = {
      id: newDealId(),
      stageId: "lead",
      saleName,
      contactName,
      contactEmail,
      productStartDate,
      priceListItemId: item.id,
      productName: item.name,
      unitPricePence: item.unitPricePence,
      paid: false,
      paidAt: null,
      lossReason: null,
      lossNote: "",
      notes,
    };

    const existing = readDeals();
    saveDeals([...existing, deal]);
    router.push("/dashboard/pipeline");
  };

  return (
    <div className="mx-auto max-w-lg space-y-8 pb-8">
      <div>
        <Link
          href="/dashboard/pipeline"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-crm-muted transition hover:text-crm-cream"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Back to pipeline
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-crm-cream">
          New deal
        </h1>
        <p className="mt-1 text-sm text-crm-muted">
          Creates a deal in <strong className="font-medium text-crm-cream/90">Lead</strong>.
          Link it to your contacts — new details are saved to{" "}
          <Link
            href="/dashboard/contacts"
            className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
          >
            Contacts
          </Link>{" "}
          and show in that person&apos;s contact history.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-crm-border bg-crm-elevated/20 p-5 shadow-sm"
      >
        <div
          className="flex rounded-xl border border-crm-border/80 bg-crm-bg/35 p-1"
          role="group"
          aria-label="How to link this deal to a contact"
        >
          <button
            type="button"
            onClick={() => {
              setLinkMode("create");
              setError(null);
              setAssignPick(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              linkMode === "create"
                ? "bg-crm-active/90 text-crm-cream shadow-sm"
                : "text-crm-muted hover:text-crm-cream"
            }`}
          >
            <UserPlus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Create new contact
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkMode("assign");
              setError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              linkMode === "assign"
                ? "bg-crm-active/90 text-crm-cream shadow-sm"
                : "text-crm-muted hover:text-crm-cream"
            }`}
          >
            <Users className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Assign to contact
          </button>
        </div>

        {linkMode === "create" ? (
          <div className="space-y-3 rounded-xl border border-crm-border/50 bg-crm-bg/20 p-4">
            <p className="text-xs text-crm-muted">
              Creates a <strong className="font-medium text-crm-cream/85">customer</strong>{" "}
              contact with the same fields as Add contact. The deal is logged in their
              contact history.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={cfId} className="text-sm font-medium text-crm-cream/95">
                  First name
                </label>
                <input
                  id={cfId}
                  value={createFirst}
                  onChange={(e) => setCreateFirst(e.target.value)}
                  autoComplete="given-name"
                  className={controlClass}
                  placeholder="Jane"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={clId} className="text-sm font-medium text-crm-cream/95">
                  Last name
                </label>
                <input
                  id={clId}
                  value={createLast}
                  onChange={(e) => setCreateLast(e.target.value)}
                  autoComplete="family-name"
                  className={controlClass}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={cpId} className="text-sm font-medium text-crm-cream/95">
                Phone number
              </label>
              <input
                id={cpId}
                type="tel"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                autoComplete="tel"
                className={controlClass}
                placeholder="+44 7700 900000"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ceId} className="text-sm font-medium text-crm-cream/95">
                Email address
              </label>
              <input
                id={ceId}
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                autoComplete="email"
                className={controlClass}
                placeholder="jane@company.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={cjId} className="text-sm font-medium text-crm-cream/95">
                Job title
              </label>
              <input
                id={cjId}
                value={createJob}
                onChange={(e) => setCreateJob(e.target.value)}
                autoComplete="organization-title"
                className={controlClass}
                placeholder="Head of Procurement"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-crm-border/50 bg-crm-bg/20 p-4">
            <p className="text-xs text-crm-muted">
              Pick someone already in Contacts (saved or from the pipeline). This deal is
              appended to their <strong className="font-medium text-crm-cream/85">contact history</strong>.
            </p>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-crm-muted"
                strokeWidth={2}
                aria-hidden
              />
              <input
                id={assignSearchId}
                type="search"
                value={assignQuery}
                onChange={(e) => setAssignQuery(e.target.value)}
                placeholder="Search name or email…"
                className="w-full rounded-xl border border-crm-border bg-crm-bg/40 py-2.5 pl-10 pr-3 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15"
                aria-label="Search contacts to assign"
              />
            </div>
            {assignRows.length === 0 ? (
              <p className="text-sm text-crm-muted">
                No contacts match. Add one via Create new contact or add people on the
                pipeline first.
              </p>
            ) : (
              <ul
                className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-crm-border/40 bg-crm-bg/25 p-1"
                role="listbox"
                aria-label="Contacts"
              >
                {assignRows.map((row) => {
                  const selected =
                    assignPick &&
                    ((assignPick.source === "manual" &&
                      row.pick.source === "manual" &&
                      assignPick.id === row.pick.id) ||
                      (assignPick.source === "pipeline" &&
                        row.pick.source === "pipeline" &&
                        assignPick.key === row.pick.key));
                  return (
                    <li key={`${row.pick.source}-${row.pick.source === "manual" ? row.pick.id : row.pick.key}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={!!selected}
                        onClick={() => setAssignPick(row.pick)}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          selected
                            ? "bg-crm-active/90 text-crm-cream shadow-sm"
                            : "text-crm-cream hover:bg-white/10"
                        }`}
                      >
                        <span className="font-medium">{row.label}</span>
                        <span
                          className={
                            selected ? "text-crm-cream/85" : "text-crm-muted"
                          }
                        >
                          {row.email} · {row.sub}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={saleNameId}
            className="text-sm font-medium text-crm-cream/95"
          >
            Sale name
          </label>
          <input
            id={saleNameId}
            name="sale_name"
            type="text"
            required
            autoComplete="off"
            placeholder="Short name shown on the pipeline"
            className={controlClass}
          />
          <p className="text-xs text-crm-muted">
            This appears on the board instead of the contact name to save space.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={dateId} className="text-sm font-medium text-crm-cream/95">
            Product start date
          </label>
          <input
            id={dateId}
            name="product_start_date"
            type="date"
            required
            className={controlClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={productId} className="text-sm font-medium text-crm-cream/95">
            Product name
          </label>
          <select
            id={productId}
            name="product_id"
            required={priceList.length > 0}
            className={selectClass}
            style={selectChevron}
            defaultValue=""
          >
            {priceList.length === 0 ? (
              <option value="" disabled className="bg-crm-bg text-crm-cream">
                No price list items yet
              </option>
            ) : (
              <>
                <option value="" disabled className="bg-crm-bg text-crm-cream">
                  Select a product
                </option>
                {priceList.map((p) => (
                  <option key={p.id} value={p.id} className="bg-crm-bg text-crm-cream">
                    {p.name} — {formatGbpFromPence(p.unitPricePence)}
                  </option>
                ))}
              </>
            )}
          </select>
          {priceList.length === 0 ? (
            <p className="text-xs text-crm-muted">
              Add products in{" "}
              <Link
                href="/dashboard/pipeline/price-list"
                className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
              >
                Price list
              </Link>{" "}
              first.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={notesId} className="text-sm font-medium text-crm-cream/95">
            Notes{" "}
            <span className="font-normal text-crm-muted">
              (first entry on the deal timeline)
            </span>
          </label>
          <textarea
            id={notesId}
            name="notes"
            rows={4}
            placeholder="Call notes, context, next steps…"
            className={`${controlClass} min-h-[6rem] resize-y`}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-300/95" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={priceList.length === 0}
          className="w-full rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream disabled:pointer-events-none disabled:opacity-50"
        >
          Add deal to pipeline
        </button>
      </form>

      <p className="text-xs text-crm-muted">
        Tip: after saving, open the deal from the board to edit details and add more
        timeline notes.
      </p>
    </div>
  );
}
