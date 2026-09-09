import { DropType } from "@/context/types";
import { formatUpcomingRange } from "@/utils";
import { ItemThumb } from "@/components";

const TYPE_LABELS: Record<string, string> = {
  emote: "emote",
  accessory: "accessory",
  badge: "badge",
};

export const UpcomingStrip = ({ drops }: { drops: DropType[] }) => {
  if (!drops.length) return null;

  return (
    <div className="card py-3 px-4">
      <div className="upcoming-tag w-fit">Upcoming</div>

      <ul className="flex flex-col gap-1">
        {drops.map((drop) => {
          const typeLabel = TYPE_LABELS[drop.unlockType] || "reward";
          const range = formatUpcomingRange(drop.startDate, drop.endDate);

          return (
            <li key={drop.id} className="flex items-center gap-1 text-sm text-ink-soft">
              <span aria-hidden="true">
                {drop.mystery ? (
                  "❓"
                ) : (
                  <ItemThumb
                    name={drop.itemName}
                    previewUrl={drop.itemPreviewUrl}
                    unlockType={drop.unlockType}
                    size="xs"
                  />
                )}
              </span>
              <span className="font-medium text-ink">
                {drop.mystery ? `Mystery ${typeLabel}` : drop.itemName || typeLabel}
              </span>
              {range && <span>— {range}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default UpcomingStrip;
