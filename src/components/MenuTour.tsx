import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { TUTORIAL_KEY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n/en";

type Step = { id: string; title: MessageKey; body: MessageKey };

function laterKey(userId: number) {
  return `${TUTORIAL_KEY}_later_${userId}`;
}

export function MenuTour() {
  const { realUser, completeTutorial } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);

  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [
      { id: "dashboard", title: "tour.step.dashboard.title", body: "tour.step.dashboard.body" },
      { id: "documents", title: "tour.step.documents.title", body: "tour.step.documents.body" },
      { id: "projectsDocs", title: "tour.step.projectsDocs.title", body: "tour.step.projectsDocs.body" },
      { id: "operations", title: "tour.step.operations.title", body: "tour.step.operations.body" },
      { id: "tools", title: "tour.step.tools.title", body: "tour.step.tools.body" },
      { id: "profile", title: "tour.step.profile.title", body: "tour.step.profile.body" },
    ];
    if (realUser?.is_admin) {
      list.splice(3, 0, { id: "reports", title: "tour.step.reports.title", body: "tour.step.reports.body" });
      list.splice(list.length - 1, 0, {
        id: "accounting",
        title: "tour.step.accounting.title",
        body: "tour.step.accounting.body",
      });
      list.splice(list.length - 1, 0, { id: "setup", title: "tour.step.setup.title", body: "tour.step.setup.body" });
    }
    return list;
  }, [realUser?.is_admin]);

  if (!realUser || realUser.must_change_password || realUser.tutorial_done || hidden) return null;
  if (typeof window !== "undefined" && sessionStorage.getItem(laterKey(realUser.id))) return null;

  const current = steps[step];
  const last = step === steps.length - 1;

  async function neverShow() {
    setHidden(true);
    await completeTutorial();
  }

  function later() {
    if (!realUser) return;
    sessionStorage.setItem(laterKey(realUser.id), "1");
    setHidden(true);
  }

  async function next() {
    if (last) {
      await neverShow();
      return;
    }
    setStep((n) => n + 1);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div className="pointer-events-auto absolute bottom-6 left-4 right-4 max-w-md rounded-2xl border bg-card p-5 shadow-xl lg:left-[16.5rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("tour.title")} · {step + 1}/{steps.length}
        </p>
        <h3 className="mt-1 text-base font-semibold">{t(current.title)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t(current.body)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void next()}>
            {last ? t("tour.done") : t("tour.next")}
          </Button>
          <Button type="button" variant="outline" onClick={later}>
            {t("tour.later")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void neverShow()}>
            {t("tour.never")}
          </Button>
        </div>
      </div>
    </div>
  );
}
