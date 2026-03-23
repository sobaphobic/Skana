"use client";

import {
  FormField,
  PrimarySubmitButton,
} from "@/components/auth-forms";
import { saveOnboardingProfile } from "@/lib/skanaSession";
import { AuthFlowShell } from "@/components/AuthFlowShell";
import { BrandLogo } from "@/components/BrandLogo";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/browser-client";
import { LogIn, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type Mode = "login" | "signup";

function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function LoginPageInner() {
  const [mode, setMode] = useState<Mode>("login");
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorMessage =
    errorParam === "auth"
      ? "Sign-in failed. Try again or request a new magic link."
      : errorParam === "config"
        ? "Authentication is not configured on this deployment."
        : null;

  return (
    <AuthFlowShell
      header={
        <header className="mb-12 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" priority />
          <p className="max-w-[280px] text-sm leading-relaxed text-crm-muted">
            Simple CRM for small teams and co-founders
          </p>
        </header>
      }
    >
      <div className="rounded-2xl border border-crm-border bg-crm-elevated/75 p-4 shadow-lg backdrop-blur-sm sm:p-5">
        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {errorMessage}
          </p>
        ) : null}
        <div
          className="mb-6 flex border-b border-crm-border/60"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-semibold text-crm-cream transition-colors -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-cream/30 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-elevated ${
              mode === "login"
                ? "border-crm-cream"
                : "border-transparent hover:border-crm-cream/35"
            }`}
            onClick={() => setMode("login")}
          >
            <LogIn
              className="h-4 w-4 shrink-0 text-current"
              aria-hidden
              strokeWidth={2}
            />
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-semibold text-crm-cream transition-colors -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-cream/30 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-elevated ${
              mode === "signup"
                ? "border-crm-cream"
                : "border-transparent hover:border-crm-cream/35"
            }`}
            onClick={() => setMode("signup")}
          >
            <UserPlus
              className="h-4 w-4 shrink-0 text-current"
              aria-hidden
              strokeWidth={2}
            />
            Sign up
          </button>
        </div>

        <div className="min-h-[26.5rem] px-0.5">
          {mode === "login" ? <LoginForm /> : <SignupForm />}
        </div>
      </div>
    </AuthFlowShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthFlowShell
          header={
            <header className="mb-12 flex flex-col items-center gap-3 text-center">
              <BrandLogo size="md" priority />
              <p className="max-w-[280px] text-sm leading-relaxed text-crm-muted">
                Simple CRM for small teams and co-founders
              </p>
            </header>
          }
        >
          <div className="h-96 animate-pulse rounded-2xl border border-crm-border bg-crm-elevated/50" />
        </AuthFlowShell>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError(null);
        const data = new FormData(e.currentTarget);
        const password = String(data.get("password") ?? "");

        if (supabaseConfigured) {
          const email = normalizeAuthEmail(String(data.get("email") ?? ""));
          if (!email || !password) {
            setFormError("Enter email and password.");
            return;
          }
          const supabase = getBrowserSupabase();
          if (!supabase) {
            setFormError("Could not start sign-in.");
            return;
          }
          setBusy(true);
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            setBusy(false);
            let msg = error.message;
            if (/email not confirmed|confirm your email/i.test(msg)) {
              msg =
                "This email is not confirmed yet. Use the link in your sign-up email, then try again. (In Supabase: Authentication → Providers → Email → you can adjust confirmation settings.)";
            }
            setFormError(msg);
            return;
          }
          const next =
            nextRaw && nextRaw.startsWith("/") ? nextRaw : "/dashboard";
          // Full navigation so cookie-based session is visible to middleware on the next request
          // (client router.push can run before @supabase/ssr finishes syncing cookies).
          window.location.assign(next);
          return;
        }

        const username = String(data.get("username") ?? "").trim();
        console.info("[login]", { username, passwordLength: password.length });
      }}
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {formError}
        </p>
      ) : null}
      {supabaseConfigured ? (
        <FormField
          id="login-email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
        />
      ) : (
        <FormField
          id="login-username"
          name="username"
          label="Username"
          autoComplete="username"
          placeholder="yourname"
        />
      )}
      <FormField
        id="login-password"
        name="password"
        label="Password"
        type="password"
        autoComplete={
          supabaseConfigured ? "current-password" : "current-password"
        }
        placeholder="••••••••"
      />
      <PrimarySubmitButton disabled={busy}>
        {busy ? "Signing in…" : "Log in"}
      </PrimarySubmitButton>
    </form>
  );
}

function SignupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError(null);
        setInfo(null);
        const data = new FormData(e.currentTarget);
        const firstName = String(data.get("first_name") ?? "").trim();
        const lastName = String(data.get("last_name") ?? "").trim();
        const emailRaw = String(data.get("email") ?? "").trim();
        const email = supabaseConfigured
          ? normalizeAuthEmail(emailRaw)
          : emailRaw;
        const password = String(data.get("password") ?? "");

        if (supabaseConfigured) {
          if (!firstName || !lastName) {
            setFormError("First and last name are required.");
            return;
          }
          if (!email || !password) {
            setFormError("Email and password are required.");
            return;
          }
          if (password.length < 6) {
            setFormError("Password must be at least 6 characters.");
            return;
          }
          const supabase = getBrowserSupabase();
          if (!supabase) {
            setFormError("Could not start sign-up.");
            return;
          }
          setBusy(true);
          const origin =
            typeof window !== "undefined" ? window.location.origin : "";
          const { data: authData, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${origin}/auth/callback`,
              data: {
                first_name: firstName,
                last_name: lastName,
              },
            },
          });
          setBusy(false);
          if (error) {
            setFormError(error.message);
            return;
          }
          saveOnboardingProfile({
            firstName,
            lastName,
            email,
            username: "",
          });
          if (authData.session) {
            router.refresh();
            router.push("/onboarding/company");
          } else {
            setInfo(
              "Check your email for a confirmation link, then log in to continue onboarding.",
            );
          }
          return;
        }

        if (!firstName || !lastName) {
          setFormError("First and last name are required.");
          return;
        }
        console.info("[signup]", {
          firstName,
          lastName,
          email,
          passwordLength: password.length,
        });
        saveOnboardingProfile({
          firstName,
          lastName,
          email,
          username: "",
        });
        router.push("/onboarding/company");
      }}
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {formError}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-crm-border/80 bg-crm-surface/40 px-3 py-2 text-sm text-crm-muted">
          {info}
        </p>
      ) : null}
      <FormField
        id="signup-first-name"
        name="first_name"
        label="First name"
        autoComplete="given-name"
        placeholder="Jane"
      />
      <FormField
        id="signup-last-name"
        name="last_name"
        label="Last name"
        autoComplete="family-name"
        placeholder="Smith"
      />
      <FormField
        id="signup-email"
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
      />
      <FormField
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="Create a password"
      />
      <PrimarySubmitButton disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </PrimarySubmitButton>
    </form>
  );
}
