import { useI18n } from "@/lib/i18n";
import type { AccessGroup } from "@/lib/types";

export function GroupPicker({
  groups,
  selected,
  onChange,
}: {
  groups: AccessGroup[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useI18n();
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("config.user.noGroups")}</p>;
  }
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{t("config.user.groups")}</p>
        <p className="text-xs text-muted-foreground">{t("config.user.groupsHint")}</p>
      </div>
      <ul className="space-y-1.5 rounded-md border bg-card p-2">
        {groups.map((g) => {
          const on = selected.includes(g.id);
          return (
            <li key={g.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={on}
                  onChange={() =>
                    onChange(on ? selected.filter((id) => id !== g.id) : [...selected, g.id])
                  }
                />
                <span>
                  <span className="block text-sm font-medium">{g.name}</span>
                  {g.description ? (
                    <span className="block text-[11px] text-muted-foreground">{g.description}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
