"use client";

import {
  buildWorkspacePeopleFromProfile,
  fileToDataUrlIfSmall,
  fileToDataUrlIfUnder,
  formatCompanyRole,
  generateCompanyInviteCode,
  MAX_COMPANY_DOCUMENTS,
  MAX_COMPANY_DOCUMENT_BYTES,
  parseCompanySession,
  parseOnboardingProfile,
  readCompanySessionRaw,
  readOnboardingProfileRaw,
  saveCompanySession,
  subscribeCompanySession,
  type CompanyCredentialRow,
  type CompanyDocument,
} from "@/lib/skanaSession";
import { scheduleRetireCompanyInviteOnSupabase } from "@/lib/companyInviteRemote";
import {
  Building2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
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

const sectionTitle =
  "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-crm-muted";

function companyInitial(name: string) {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export default function CompanyPage() {
  const companyRaw = useSyncExternalStore(
    subscribeCompanySession,
    readCompanySessionRaw,
    () => null,
  );
  const company = useMemo(
    () => parseCompanySession(companyRaw),
    [companyRaw],
  );

  const profileRaw = useSyncExternalStore(
    () => () => {},
    readOnboardingProfileRaw,
    () => null,
  );
  const profile = useMemo(
    () => parseOnboardingProfile(profileRaw),
    [profileRaw],
  );

  const workspacePeople = useMemo(
    () => buildWorkspacePeopleFromProfile(profile, company?.company_role),
    [profile, company?.company_role],
  );

  useEffect(() => {
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    const nextPeople = buildWorkspacePeopleFromProfile(
      parseOnboardingProfile(readOnboardingProfileRaw()),
      c.company_role,
    );
    if (JSON.stringify(c.people) !== JSON.stringify(nextPeople)) {
      saveCompanySession({ ...c, people: nextPeople });
    }
  }, [companyRaw, profileRaw]);

  useEffect(() => {
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    if (c.company_invite_code?.trim()) return;
    saveCompanySession({
      ...c,
      company_invite_code: generateCompanyInviteCode(),
    });
  }, [companyRaw]);

  const [editingDetails, setEditingDetails] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftNumber, setDraftNumber] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const logoInputId = useId();

  const [newCredLabel, setNewCredLabel] = useState("");
  const [newCredValue, setNewCredValue] = useState("");
  const [newCredNotes, setNewCredNotes] = useState("");
  const [newCredSensitive, setNewCredSensitive] = useState(false);

  const [docError, setDocError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null);
  const docInputId = useId();
  const docTitleId = useId();

  const [revealedCredIds, setRevealedCredIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [copyCodeHint, setCopyCodeHint] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const startEditDetails = useCallback(() => {
    if (!company) return;
    setDraftName(company.name);
    setDraftNumber(company.company_number ?? "");
    setDraftAddress(company.company_address ?? "");
    setDraftRole(company.company_role ?? "");
    setRemoveLogo(false);
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setDetailError(null);
    setEditingDetails(true);
  }, [company, logoPreview]);

  const cancelEditDetails = useCallback(() => {
    setEditingDetails(false);
    setDetailError(null);
    setRemoveLogo(false);
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  }, [logoPreview]);

  const submitDetails = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    const name = draftName.trim();
    if (!name) {
      setDetailError("Company name is required.");
      return;
    }
    let logoDataUrl = c.logoDataUrl;
    if (removeLogo) {
      logoDataUrl = null;
    }
    if (logoFile) {
      const next = await fileToDataUrlIfSmall(logoFile);
      if (!next) {
        setDetailError(
          "Logo is too large or could not be read. Use a smaller image (under ~600KB).",
        );
        return;
      }
      logoDataUrl = next;
    }
    const roleSaved = draftRole.trim() || undefined;
    saveCompanySession({
      ...c,
      name,
      logoDataUrl,
      company_number: draftNumber.trim() || undefined,
      company_address: draftAddress.trim() || undefined,
      company_role: roleSaved,
      people: buildWorkspacePeopleFromProfile(
        parseOnboardingProfile(readOnboardingProfileRaw()),
        roleSaved,
      ),
    });
    setEditingDetails(false);
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setRemoveLogo(false);
    setDetailError(null);
  };

  const addCredential = () => {
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    const label = newCredLabel.trim();
    if (!label) return;
    const row: CompanyCredentialRow = {
      id: crypto.randomUUID(),
      label,
      value: newCredValue,
      ...(newCredNotes.trim() ? { notes: newCredNotes.trim() } : {}),
      ...(newCredSensitive ? { sensitive: true } : {}),
    };
    saveCompanySession({ ...c, credentials: [...c.credentials, row] });
    setNewCredLabel("");
    setNewCredValue("");
    setNewCredNotes("");
    setNewCredSensitive(false);
  };

  const removeCredential = (id: string) => {
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    saveCompanySession({
      ...c,
      credentials: c.credentials.filter((x) => x.id !== id),
    });
  };

  const addDocument = async () => {
    setDocError(null);
    const title = docTitle.trim();
    const file = pendingDocFile;
    if (!title) {
      setDocError("Enter a title for this document.");
      return;
    }
    if (!file || file.size === 0) {
      setDocError("Choose a file to upload.");
      return;
    }
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    if (c.documents.length >= MAX_COMPANY_DOCUMENTS) {
      setDocError(`You can store up to ${MAX_COMPANY_DOCUMENTS} documents.`);
      return;
    }
    const dataUrl = await fileToDataUrlIfUnder(file, MAX_COMPANY_DOCUMENT_BYTES);
    if (!dataUrl) {
      setDocError(
        "File is too large for browser storage. Try a smaller file or compress the PDF.",
      );
      return;
    }
    const doc: CompanyDocument = {
      id: crypto.randomUUID(),
      title,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl,
      uploadedAt: new Date().toISOString(),
    };
    saveCompanySession({ ...c, documents: [...c.documents, doc] });
    setDocTitle("");
    setPendingDocFile(null);
  };

  const removeDocument = (id: string) => {
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    saveCompanySession({
      ...c,
      documents: c.documents.filter((d) => d.id !== id),
    });
  };

  const toggleReveal = (id: string) => {
    setRevealedCredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyInviteCode = useCallback(async () => {
    const code = company?.company_invite_code?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyCodeHint("Copied to clipboard");
      window.setTimeout(() => setCopyCodeHint(null), 2000);
    } catch {
      setCopyCodeHint("Could not copy — select the code manually");
      window.setTimeout(() => setCopyCodeHint(null), 3000);
    }
  }, [company?.company_invite_code]);

  const regenerateInviteCode = useCallback(() => {
    if (
      !window.confirm(
        "Generate a new company code? The previous code will stop working for new joiners.",
      )
    ) {
      return;
    }
    const c = parseCompanySession(readCompanySessionRaw());
    if (!c?.id) return;
    const oldCode = c.company_invite_code?.trim();
    if (oldCode) scheduleRetireCompanyInviteOnSupabase(oldCode);
    saveCompanySession({
      ...c,
      company_invite_code: generateCompanyInviteCode(),
    });
  }, []);

  if (!company) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        <div className="border-b border-crm-border/40 pb-6">
          <p className={sectionTitle}>Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-crm-cream md:text-3xl">
            Company information
          </h1>
          <p className="mt-2 text-sm text-crm-muted">
            Set up a company to store your logo, team, reference numbers, and
            files in one place. Everything stays in this browser session until you
            connect a backend.
          </p>
        </div>
        <div className="rounded-2xl border border-crm-border bg-crm-elevated/20 px-6 py-12 text-center">
          <Building2
            className="mx-auto h-12 w-12 text-crm-muted/80"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm text-crm-muted">
            No company workspace loaded yet.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding/company/create"
              className="inline-flex items-center justify-center rounded-xl border border-crm-border/80 bg-crm-active/90 px-5 py-2.5 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
            >
              Set up company
            </Link>
            <Link
              href="/dashboard/company/new"
              className="inline-flex items-center justify-center rounded-xl border border-dashed border-crm-border/70 px-5 py-2.5 text-sm font-medium text-crm-muted transition hover:border-crm-cream/35 hover:text-crm-cream"
            >
              Add company (signed in)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 border-b border-crm-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={sectionTitle}>Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-crm-cream md:text-3xl">
            Company information
          </h1>
          <p className="mt-2 max-w-xl text-sm text-crm-muted">
            Logo and company details, who has access to this account, business
            numbers and logins, and documents — stored locally in this session.
          </p>
        </div>
      </div>

      {/* Company details */}
      <section className="rounded-2xl border border-crm-border bg-crm-elevated/25 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className={sectionTitle}>Company details</h2>
            <p className="mt-2 text-xs text-crm-muted">
              Name, registration, address, and your role — same fields as when
              you created the workspace.
            </p>
          </div>
          {!editingDetails ? (
            <button
              type="button"
              onClick={startEditDetails}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-crm-border/80 px-4 py-2 text-sm font-medium text-crm-cream transition hover:bg-white/5"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
              Edit details
            </button>
          ) : null}
        </div>

        {!editingDetails ? (
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="shrink-0">
              {company.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- session data URL
                <img
                  src={company.logoDataUrl}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover ring-1 ring-crm-border/80"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-crm-cream/15 text-2xl font-semibold text-crm-cream ring-1 ring-crm-border/80">
                  {companyInitial(company.name)}
                </span>
              )}
            </div>
            <dl className="min-w-0 flex-1 space-y-3 text-sm">
              <div>
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                  Company name
                </dt>
                <dd className="mt-0.5 font-medium text-crm-cream">
                  {company.name}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                  Company number
                </dt>
                <dd className="mt-0.5 text-crm-cream/95">
                  {company.company_number?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                  Address
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-crm-cream/95">
                  {company.company_address?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
                  Your role
                </dt>
                <dd className="mt-0.5 text-crm-cream/95">
                  {formatCompanyRole(company.company_role)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => void submitDetails(e)}
          >
            {detailError ? (
              <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100/95">
                {detailError}
              </p>
            ) : null}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="shrink-0">
                <p className="mb-2 text-xs font-medium text-crm-muted">
                  Logo
                </p>
                <label
                  htmlFor={logoInputId}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-crm-border bg-crm-bg/30 px-4 py-4 text-center transition hover:border-crm-cream/35"
                >
                  <input
                    id={logoInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      if (logoPreview) URL.revokeObjectURL(logoPreview);
                      if (file) {
                        setLogoFile(file);
                        setLogoPreview(URL.createObjectURL(file));
                        setRemoveLogo(false);
                      } else {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }
                      setDetailError(null);
                    }}
                  />
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-crm-border"
                    />
                  ) : company.logoDataUrl && !removeLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={company.logoDataUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-crm-border"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-crm-bg/50 text-crm-muted ring-1 ring-crm-border/80">
                      <ImageIcon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                    </span>
                  )}
                  <span className="text-xs text-crm-muted">
                    Replace logo
                  </span>
                </label>
                {company.logoDataUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveLogo(true);
                      setLogoFile(null);
                      if (logoPreview) URL.revokeObjectURL(logoPreview);
                      setLogoPreview(null);
                    }}
                    className="mt-2 text-xs font-medium text-crm-muted underline-offset-2 hover:text-crm-cream hover:underline"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="co-name"
                    className="text-xs font-medium text-crm-muted"
                  >
                    Company name
                  </label>
                  <input
                    id="co-name"
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      setDetailError(null);
                    }}
                    className={controlClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="co-num"
                    className="text-xs font-medium text-crm-muted"
                  >
                    Company number
                  </label>
                  <input
                    id="co-num"
                    value={draftNumber}
                    onChange={(e) => setDraftNumber(e.target.value)}
                    className={controlClass}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="co-addr"
                    className="text-xs font-medium text-crm-muted"
                  >
                    Company address
                  </label>
                  <textarea
                    id="co-addr"
                    value={draftAddress}
                    onChange={(e) => setDraftAddress(e.target.value)}
                    rows={3}
                    className={`${controlClass} resize-y min-h-[5rem]`}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="co-role"
                    className="text-xs font-medium text-crm-muted"
                  >
                    Your role
                  </label>
                  <select
                    id="co-role"
                    value={draftRole}
                    onChange={(e) => setDraftRole(e.target.value)}
                    className={`${controlClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    }}
                  >
                    <option value="">Select your role</option>
                    <option value="owner">Owner</option>
                    <option value="co_founder">Co-founder</option>
                    <option value="director">Director</option>
                    <option value="admin">Administrator</option>
                    <option value="member">Team member</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                className="rounded-xl border border-crm-border/80 bg-crm-active/90 px-4 py-2 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={cancelEditDetails}
                className="rounded-xl border border-crm-border/80 px-4 py-2 text-sm font-medium text-crm-cream transition hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Company invite code */}
      <section className="rounded-2xl border border-crm-border bg-crm-elevated/25 p-5 shadow-sm">
        <h2 className={sectionTitle}>Company login code</h2>
        <p className="mt-2 text-xs text-crm-muted">
          New teammates enter this on{" "}
          <Link
            href="/onboarding/company/join"
            className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
          >
            Join existing company
          </Link>{" "}
          during onboarding. It is also saved in this browser&apos;s local storage
          so joins can work in another tab on the same computer (until you have
          a real backend).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 rounded-xl border border-crm-border/60 bg-crm-bg/25 px-4 py-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted">
              Code
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-crm-cream">
              {company.company_invite_code?.trim() || "Generating…"}
            </p>
            {copyCodeHint ? (
              <p className="mt-2 text-xs text-crm-muted">{copyCodeHint}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyInviteCode()}
              disabled={!company.company_invite_code?.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
              Copy code
            </button>
            <button
              type="button"
              onClick={regenerateInviteCode}
              className="inline-flex items-center gap-2 rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
              New code
            </button>
          </div>
        </div>
      </section>

      {/* People */}
      <section className="rounded-2xl border border-crm-border bg-crm-elevated/25 p-5 shadow-sm">
        <h2 className={sectionTitle}>People</h2>
        <p className="mt-2 text-xs text-crm-muted">
          Everyone with access to this account in the current browser session.
          Your name and email come from sign-up; your role is the one set under
          company details above.
        </p>

        {workspacePeople.length === 0 ? (
          <p className="mt-4 text-sm text-crm-muted">
            No profile is stored in this session, so we can&apos;t show a person
            row yet. Complete sign-up with your name, or open this workspace
            from the same browser where you logged in.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-crm-border/40 rounded-xl border border-crm-border/50 bg-crm-bg/20">
            {workspacePeople.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <p className="font-medium text-crm-cream">{p.name}</p>
                <p className="text-sm text-crm-muted">{p.role}</p>
                {p.email ? (
                  <a
                    href={`mailto:${p.email}`}
                    className="mt-0.5 block truncate text-xs text-crm-cream/80 underline-offset-2 hover:underline"
                  >
                    {p.email}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Numbers & logins */}
      <section className="rounded-2xl border border-crm-border bg-crm-elevated/25 p-5 shadow-sm">
        <h2 className={sectionTitle}>Key business numbers &amp; logins</h2>
        <p className="mt-2 text-xs text-crm-muted">
          VAT, bank details, software accounts, or other references. Mark rows
          as sensitive to hide values behind a toggle. Stored only in this
          browser session — not for production secrets.
        </p>

        {company.credentials.length === 0 ? (
          <p className="mt-4 text-sm text-crm-muted">
            Nothing saved yet. Add a row below.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {company.credentials.map((row) => {
              const revealed = revealedCredIds.has(row.id);
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-crm-border/50 bg-crm-bg/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-crm-cream">
                        {row.label}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {row.sensitive ? (
                          <input
                            type={revealed ? "text" : "password"}
                            readOnly
                            value={row.value}
                            className="max-w-full border-0 bg-transparent p-0 text-sm text-crm-cream/95 outline-none"
                            aria-label={row.label}
                          />
                        ) : (
                          <p className="break-all text-sm text-crm-cream/95">
                            {row.value || "—"}
                          </p>
                        )}
                        {row.sensitive ? (
                          <button
                            type="button"
                            onClick={() => toggleReveal(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-crm-border/70 px-2 py-1 text-xs text-crm-muted transition hover:text-crm-cream"
                            aria-label={revealed ? "Hide value" : "Show value"}
                          >
                            {revealed ? (
                              <EyeOff className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {revealed ? "Hide" : "Show"}
                          </button>
                        ) : null}
                      </div>
                      {row.notes ? (
                        <p className="mt-2 text-xs text-crm-muted">{row.notes}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCredential(row.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-crm-border/70 px-2.5 py-1.5 text-xs font-medium text-crm-muted transition hover:border-red-400/40 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 space-y-3 rounded-xl border border-crm-border/50 bg-crm-bg/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="nc-label"
                className="text-xs font-medium text-crm-muted"
              >
                Label
              </label>
              <input
                id="nc-label"
                value={newCredLabel}
                onChange={(e) => setNewCredLabel(e.target.value)}
                placeholder="e.g. VAT number, Xero login"
                className={controlClass}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="nc-value"
                className="text-xs font-medium text-crm-muted"
              >
                Value
              </label>
              <input
                id="nc-value"
                type={newCredSensitive ? "password" : "text"}
                value={newCredValue}
                onChange={(e) => setNewCredValue(e.target.value)}
                placeholder="Number, URL, username…"
                className={controlClass}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="nc-notes"
              className="text-xs font-medium text-crm-muted"
            >
              Notes (optional)
            </label>
            <input
              id="nc-notes"
              value={newCredNotes}
              onChange={(e) => setNewCredNotes(e.target.value)}
              placeholder="Reminder, URL to portal…"
              className={controlClass}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-crm-cream/90">
            <input
              type="checkbox"
              checked={newCredSensitive}
              onChange={(e) => setNewCredSensitive(e.target.checked)}
              className="rounded border-crm-border bg-crm-bg/40"
            />
            Sensitive (mask like a password)
          </label>
          <button
            type="button"
            onClick={addCredential}
            disabled={!newCredLabel.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-crm-border/80 bg-crm-active/80 px-4 py-2 text-sm font-medium text-crm-cream transition hover:bg-crm-active disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add entry
          </button>
        </div>
      </section>

      {/* Documents */}
      <section className="rounded-2xl border border-crm-border bg-crm-elevated/25 p-5 shadow-sm">
        <h2 className={sectionTitle}>Important documents</h2>
        <p className="mt-2 text-xs text-crm-muted">
          Give each file a clear title, then upload a PDF or image. Max{" "}
          {MAX_COMPANY_DOCUMENTS} files; each must stay under about{" "}
          {Math.round(MAX_COMPANY_DOCUMENT_BYTES / 1000)}KB so session storage
          does not overflow.
        </p>

        {docError ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-crm-cream/95">
            {docError}
          </p>
        ) : null}

        <div className="mt-4 space-y-3 rounded-xl border border-crm-border/50 bg-crm-bg/15 p-4">
          <div className="space-y-1">
            <label
              htmlFor={docTitleId}
              className="text-xs font-medium text-crm-muted"
            >
              Document title
            </label>
            <input
              id={docTitleId}
              value={docTitle}
              onChange={(e) => {
                setDocTitle(e.target.value);
                setDocError(null);
              }}
              placeholder="e.g. Employers’ liability certificate 2026"
              className={controlClass}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-crm-muted">File</span>
            <label
              htmlFor={docInputId}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-crm-border bg-crm-bg/20 px-4 py-6 text-center transition hover:border-crm-cream/35 hover:bg-crm-bg/30"
            >
              <input
                id={docInputId}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPendingDocFile(f ?? null);
                  setDocError(null);
                  e.target.value = "";
                }}
              />
              <FileText className="h-7 w-7 text-crm-muted" strokeWidth={1.5} aria-hidden />
              <span className="text-sm text-crm-muted">
                <span className="font-medium text-crm-cream">Choose file</span>
                {pendingDocFile ? (
                  <span className="mt-1 block truncate text-xs">
                    {pendingDocFile.name}
                  </span>
                ) : (
                  <span className="block text-xs">PDF or image</span>
                )}
              </span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void addDocument()}
            disabled={!docTitle.trim() || !pendingDocFile}
            className="inline-flex items-center gap-2 rounded-xl border border-crm-border/80 bg-crm-active/80 px-4 py-2 text-sm font-medium text-crm-cream transition hover:bg-crm-active disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add document
          </button>
        </div>

        {company.documents.length === 0 ? (
          <p className="mt-4 text-sm text-crm-muted">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {company.documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-xl border border-crm-border/50 bg-crm-bg/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-crm-cream">
                    {d.title}
                  </p>
                  <p className="truncate text-xs text-crm-muted">
                    File: {d.fileName}
                  </p>
                  <p className="text-xs text-crm-muted">
                    Added{" "}
                    {new Date(d.uploadedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={d.dataUrl}
                    download={d.fileName}
                    className="inline-flex items-center justify-center rounded-lg border border-crm-border/80 px-3 py-1.5 text-xs font-medium text-crm-cream transition hover:bg-white/5"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => removeDocument(d.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-crm-border/70 px-3 py-1.5 text-xs font-medium text-crm-muted transition hover:border-red-400/40 hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
