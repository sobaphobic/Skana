"use client";

import {
  FormField,
  FormSelect,
  FormTextarea,
  PrimarySubmitButton,
} from "@/components/auth-forms";
import {
  appendCompanyToWorkspace,
  buildWorkspacePeopleFromProfile,
  fileToDataUrlIfSmall,
  generateCompanyInviteCode,
  parseOnboardingProfile,
  readOnboardingProfileRaw,
} from "@/lib/skanaSession";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

export default function DashboardNewCompanyPage() {
  const router = useRouter();
  const logoInputId = useId();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  return (
    <div className="mx-auto max-w-[520px] space-y-6 pb-10">
      <div className="border-b border-crm-border/40 pb-6">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-crm-muted">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-crm-cream">
          Add a company
        </h1>
        <p className="mt-2 text-sm text-crm-muted">
          Same details as your first workspace. Pipeline, contacts, and team
          data stay separate for each company.
        </p>
      </div>

      <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 p-4 shadow-sm sm:p-5">
        <form
          className="flex flex-col gap-4 px-0.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("company_name") ?? "").trim();
            if (!name) return;

            const logo = fd.get("company_logo");
            let logoDataUrl: string | null = null;
            if (logo instanceof File && logo.size > 0) {
              logoDataUrl = await fileToDataUrlIfSmall(logo);
            }

            const company_role =
              String(fd.get("company_role") ?? "").trim() || undefined;
            const profile = parseOnboardingProfile(readOnboardingProfileRaw());
            appendCompanyToWorkspace(
              {
                name,
                logoDataUrl,
                company_number:
                  String(fd.get("company_number") ?? "").trim() || undefined,
                company_address:
                  String(fd.get("company_address") ?? "").trim() || undefined,
                company_role,
                company_invite_code: generateCompanyInviteCode(),
                people: buildWorkspacePeopleFromProfile(profile, company_role),
                credentials: [],
                documents: [],
              },
              { makeActive: false },
            );
            router.push("/dashboard/company");
          }}
        >
          <FormField
            id="company_name"
            name="company_name"
            label="Company name"
            autoComplete="organization"
            placeholder="e.g. Acme Ltd"
          />
          <FormField
            id="company_number"
            name="company_number"
            label="Company number"
            placeholder="Companies House or equivalent"
          />
          <FormTextarea
            id="company_address"
            name="company_address"
            label="Company address"
            placeholder="Street, city, postcode, country"
            rows={4}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-crm-cream/95">
              Company logo
            </span>
            <label
              htmlFor={logoInputId}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-crm-border bg-crm-bg/30 px-4 py-8 text-center transition hover:border-crm-cream/35 hover:bg-crm-bg/45"
            >
              <input
                id={logoInputId}
                name="company_logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (logoPreview) URL.revokeObjectURL(logoPreview);
                  if (file) {
                    setLogoPreview(URL.createObjectURL(file));
                    setLogoName(file.name);
                  } else {
                    setLogoPreview(null);
                    setLogoName(null);
                  }
                }}
              />
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover ring-1 ring-crm-border"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-crm-bg/50 text-crm-muted ring-1 ring-crm-border/80">
                  <ImageIcon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                </span>
              )}
              <span className="text-sm text-crm-muted">
                <span className="font-medium text-crm-cream">
                  Click to upload
                </span>{" "}
                — PNG, JPG, WebP or SVG.
              </span>
              {logoName ? (
                <span className="max-w-full truncate text-xs text-crm-muted">
                  {logoName}
                </span>
              ) : null}
            </label>
          </div>

          <FormSelect
            id="company_role"
            name="company_role"
            label="Company role"
          >
            <option value="" disabled>
              Select your role
            </option>
            <option value="owner">Owner</option>
            <option value="co_founder">Co-founder</option>
            <option value="director">Director</option>
            <option value="admin">Administrator</option>
            <option value="member">Team member</option>
            <option value="other">Other</option>
          </FormSelect>

          <PrimarySubmitButton>Create company</PrimarySubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-crm-muted">
          <Link
            href="/dashboard/company"
            className="font-medium text-crm-cream underline-offset-2 hover:underline"
          >
            ← Back to Company
          </Link>
        </p>
      </div>
    </div>
  );
}
