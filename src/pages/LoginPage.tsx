import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BorderBeam } from "@/components/ui/border-beam";
import { GridPattern } from "@/components/ui/grid-pattern";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const DIM_SQUARES: Array<[number, number]> = [
  [2, 1],
  [5, 0],
  [8, 2],
  [1, 4],
  [11, 3],
  [14, 1],
  [3, 7],
  [7, 6],
  [12, 8],
  [0, 9],
  [16, 6],
  [9, 10],
  [4, 12],
  [13, 11],
  [18, 9],
  [6, 14],
  [15, 13],
];

export function LoginPage() {
  const { user, ready, login, needsSetup, setupAdmin } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (ready && user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const msg = needsSetup
        ? await setupAdmin({ name, email, password })
        : await login(email, password);
      if (msg) setError(t(msg as "login.error.invalid"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.error.invalid"));
    } finally {
      setSubmitting(false);
    }
  }

  function pickLang(next: Locale) {
    setLocale(next);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 12% 8%, rgba(251,170,25,0.18), transparent 52%), radial-gradient(ellipse 80% 60% at 92% 88%, rgba(251,170,25,0.12), transparent 50%), radial-gradient(ellipse 55% 45% at 50% 48%, rgba(251,170,25,0.07), transparent 62%)",
        }}
      />
      <GridPattern
        width={52}
        height={52}
        squares={DIM_SQUARES}
        className="fill-[#fbaa19]/[0.07] stroke-[#51514e]/50 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,#000_40%,transparent)]"
      />

      <div className="relative w-full max-w-[400px] overflow-hidden rounded-sm border border-[#51514e] bg-black p-10 sm:p-12">
        <BorderBeam
          size={140}
          duration={8}
          borderWidth={2}
          colorFrom="#fbaa19"
          colorTo="#fff4d4"
        />
        <BorderBeam
          size={90}
          duration={8}
          delay={4}
          borderWidth={2}
          colorFrom="#fff4d4"
          colorTo="#fbaa19"
        />

        <form onSubmit={onSubmit} className="relative space-y-5">
          <div className="flex flex-col items-center pb-6">
            <img
              src="/brand/logo-icon.png"
              alt=""
              className="size-20 object-contain sm:size-24"
            />
            <p className="mt-4 font-display text-[22px] font-semibold uppercase leading-none tracking-[0.18em] text-white sm:text-[24px]">
              FRX
            </p>
            <p className="mt-1.5 font-display text-[11px] font-medium uppercase tracking-[0.38em] text-[#fbaa19]">
              {needsSetup ? t("login.setup.title") : t("brand.construction")}
            </p>
            {needsSetup ? (
              <p className="mt-3 text-center text-[12px] leading-relaxed text-[#8a8a86]">{t("login.setup.hint")}</p>
            ) : null}
          </div>

          <div className="flex justify-center gap-1">
            {(["en", "fr"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => pickLang(code)}
                className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  locale === code ? "text-[#fbaa19]" : "text-[#8a8a86] hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {needsSetup ? (
            <div className="space-y-2">
              <Label htmlFor="name" className="sr-only">
                {t("login.setup.name")}
              </Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder={t("login.setup.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-none border-[#51514e] bg-transparent text-white placeholder:text-[#8a8a86] focus-visible:border-[#fbaa19] focus-visible:ring-[#fbaa19]/30"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email" className="sr-only">
              {t("login.email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder={t("login.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-none border-[#51514e] bg-transparent text-white placeholder:text-[#8a8a86] focus-visible:border-[#fbaa19] focus-visible:ring-[#fbaa19]/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="sr-only">
              {t("login.password")}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={needsSetup ? "new-password" : "current-password"}
              placeholder={t("login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={needsSetup ? 8 : undefined}
              className="h-11 rounded-none border-[#51514e] bg-transparent text-white placeholder:text-[#8a8a86] focus-visible:border-[#fbaa19] focus-visible:ring-[#fbaa19]/30"
            />
          </div>

          {error && (
            <p className="text-center text-sm text-[#fbaa19]" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting || !ready}
            className="h-11 w-full rounded-none bg-[#fbaa19] font-display text-[15px] font-semibold uppercase tracking-[0.18em] text-black hover:bg-[#fbaa19]/90"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "…" : needsSetup ? t("login.setup.submit") : t("login.enter")}
          </Button>
        </form>
      </div>
    </div>
  );
}
