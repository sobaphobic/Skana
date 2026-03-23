import {
  buildWorkspacePeopleFromProfile,
  formatWelcomeDisplayName,
  parseOnboardingProfile,
  readOnboardingProfileRaw,
  WORKSPACE_ACCOUNT_PERSON_ID,
  type CompanyPerson,
  type CompanySession,
} from "@/lib/skanaSession";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/browser-client";

export const WORKSPACE_MEMBER_REMOTE_PREFIX = "skana_wm_" as const;

export function remoteWorkspaceMemberPersonId(authUserId: string): string {
  return `${WORKSPACE_MEMBER_REMOTE_PREFIX}${authUserId.trim()}`;
}

type MemberRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

function displayNameFromProfile(): string {
  const profile = parseOnboardingProfile(readOnboardingProfileRaw());
  const welcome = formatWelcomeDisplayName(profile);
  if (welcome !== "there") return welcome;
  const email = profile?.email?.trim();
  if (email) return email;
  const u = profile?.username?.trim();
  if (u) return u;
  return "Member";
}

function emailFromProfile(): string {
  const profile = parseOnboardingProfile(readOnboardingProfileRaw());
  return profile?.email?.trim() ?? "";
}

/**
 * Register the signed-in user for each company invite code they belong to.
 */
export async function registerWorkspaceMembershipForCompanies(
  companies: {
    company_invite_code?: string;
    company_role?: string;
  }[],
): Promise<void> {
  if (!isSupabaseConfigured() || companies.length === 0) return;
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const displayName = displayNameFromProfile();
  const email = emailFromProfile() || session.user.email?.trim() || "";

  for (const c of companies) {
    const code = c.company_invite_code?.trim();
    if (!code) continue;
    const role = c.company_role?.trim() || null;
    const { error } = await supabase.rpc("upsert_workspace_member", {
      p_workspace_code: code,
      p_display_name: displayName,
      p_email: email,
      p_role: role,
    });
    if (error) {
      console.warn("[SkAna] upsert_workspace_member", error.message);
    }
  }
}

/** Call after joining a company so you appear in teammates’ People list. */
export async function registerWorkspaceMembershipForInviteCode(
  inviteCodeDisplay: string,
  companyRole?: string,
): Promise<void> {
  if (!inviteCodeDisplay.trim()) return;
  await registerWorkspaceMembershipForCompanies([
    {
      company_invite_code: inviteCodeDisplay.trim(),
      company_role: companyRole,
    },
  ]);
}

function peopleListsEqual(a: CompanyPerson[], b: CompanyPerson[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Local “you” row plus remote teammates (same company invite code), for `company.people`.
 */
export async function buildMergedWorkspacePeople(
  company: CompanySession,
  profileRaw: string | null,
): Promise<CompanyPerson[]> {
  const profile = parseOnboardingProfile(profileRaw);
  const localSelfRows = buildWorkspacePeopleFromProfile(
    profile,
    company.company_role,
  );

  if (!isSupabaseConfigured() || !company.company_invite_code?.trim()) {
    return localSelfRows;
  }

  const supabase = getBrowserSupabase();
  if (!supabase) return localSelfRows;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return localSelfRows;

  const { data, error } = await supabase.rpc("list_workspace_members", {
    p_workspace_code: company.company_invite_code.trim(),
  });

  if (error) {
    console.warn("[SkAna] list_workspace_members", error.message);
    return localSelfRows;
  }

  const rows = Array.isArray(data) ? (data as MemberRow[]) : [];
  const selfId = user.id;
  const byId = new Map<string, CompanyPerson>();

  for (const p of localSelfRows) {
    byId.set(p.id, p);
  }

  for (const row of rows) {
    const uid = row.user_id;
    if (!uid || uid === selfId) continue;
    const id = remoteWorkspaceMemberPersonId(uid);
    byId.set(id, {
      id,
      name: (row.display_name || "").trim() || "Teammate",
      role: (row.role || "").trim() || "Member",
      ...(row.email?.trim() ? { email: row.email.trim() } : {}),
    });
  }

  const out = Array.from(byId.values());
  out.sort((a, b) => {
    if (a.id === WORKSPACE_ACCOUNT_PERSON_ID) return -1;
    if (b.id === WORKSPACE_ACCOUNT_PERSON_ID) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return out;
}

export function shouldUpdateCompanyPeople(
  prev: CompanyPerson[] | undefined,
  next: CompanyPerson[],
): boolean {
  return !peopleListsEqual(prev ?? [], next);
}
