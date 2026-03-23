"use client";

import {
  FormField,
  PrimarySubmitButton,
} from "@/components/auth-forms";
import { saveOnboardingProfile } from "@/lib/skanaSession";
import { AuthFlowShell } from "@/components/AuthFlowShell";
import { BrandLogo } from "@/components/BrandLogo";
import { LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

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

function LoginForm() {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const username = String(data.get("username") ?? "").trim();
        const password = String(data.get("password") ?? "");
        console.info("[login]", { username, passwordLength: password.length });
      }}
    >
      <FormField
        id="login-username"
        name="username"
        label="Username"
        autoComplete="username"
        placeholder="yourname"
      />
      <FormField
        id="login-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
      />
      <PrimarySubmitButton>Log in</PrimarySubmitButton>
    </form>
  );
}

function SignupForm() {
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const firstName = String(data.get("first_name") ?? "").trim();
        const lastName = String(data.get("last_name") ?? "").trim();
        const email = String(data.get("email") ?? "").trim();
        const username = String(data.get("username") ?? "").trim();
        const password = String(data.get("password") ?? "");
        console.info("[signup]", {
          firstName,
          lastName,
          email,
          username,
          passwordLength: password.length,
        });
        saveOnboardingProfile({
          firstName,
          lastName,
          email,
          username,
        });
        router.push("/onboarding/company");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      <FormField
        id="signup-email"
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
      />
      <FormField
        id="signup-username"
        name="username"
        label="Username"
        autoComplete="username"
        placeholder="Choose a username"
      />
      <FormField
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="Create a password"
      />
      <PrimarySubmitButton>Create account</PrimarySubmitButton>
    </form>
  );
}

