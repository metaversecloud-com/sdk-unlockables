import { DropType } from "@/context/types";
import { ItemThumb } from "@/components";

/**
 * Up to three most-recently-ended drops — a marker of what was earned and what was missed
 */
export const RecentDropsStrip = ({ drops }: { drops: DropType[] }) => {
  if (!drops.length) return null;

  return (
    <div className="card py-4">
      <h4 className="text-sm font-semibold text-secondary">Recent Drops</h4>

      <div className="flex flex-wrap gap-3">
        {drops.map((drop) => (
          <div key={drop.id} className="text-center">
            <ItemThumb
              name={drop.itemName}
              previewUrl={drop.itemPreviewUrl}
              unlockType={drop.unlockType}
              muted={!drop.claimed}
              size="xs"
              frameClassName="rounded-md border border-warm-border bg-surface p-1.5"
            />
            <p className={`text-xs mt-1 ${drop.claimed ? "font-medium text-ink-soft" : "text-ink-muted"}`}>
              {drop.itemName}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-soft/70">Full color = unlocked · greyed = missed</p>
    </div>
  );
};

export default RecentDropsStrip;
