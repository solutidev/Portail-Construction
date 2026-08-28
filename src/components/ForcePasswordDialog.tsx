import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForcePasswordDialog() {
  const { realUser, changePassword } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!realUser?.must_change_password) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(t("profile.passwordMismatch"));
      return;
    }
    setSaving(true);
    const err = await changePassword(current, next);
    setSaving(false);
    if (err) {
      const known = err === "profile.passwordWrong" || err === "profile.passwordShort" || err === "profile.passwordMismatch";
      setError(known ? t(err) : t("profile.passwordWrong"));
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{t("forcePw.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("forcePw.hint")}</p>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>{t("profile.currentPassword")}</Label>
            <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("profile.newPassword")}</Label>
            <Input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("profile.confirmPassword")}</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <Button type="submit" className="mt-5 w-full" disabled={saving}>
          {saving ? t("people.saving") : t("forcePw.submit")}
        </Button>
      </form>
    </div>
  );
}
