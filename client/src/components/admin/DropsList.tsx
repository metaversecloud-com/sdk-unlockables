import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GlobalDispatchContext } from "@/context/GlobalContext";
import { AdminDropType, DropState, ErrorType, QuestionType } from "@/context/types";
import { backendAPI, formatDropRange, setErrorMessage } from "@/utils";
import { ItemThumb } from "@/components";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Text input",
  open_text: "Open response",
  multiple_choice: "Multiple choice",
  all_that_apply: "All that apply",
};

const STATE_CHIP: Record<DropState, { label: string; className: string; showCount: boolean }> = {
  always: { label: "Always on", className: "drop-chip-always", showCount: true },
  live: { label: "Live", className: "drop-chip-live-strong", showCount: true },
  ended: { label: "Ended", className: "drop-chip-ended", showCount: true },
  upcoming: { label: "Upcoming", className: "drop-chip-upcoming", showCount: false },
};

/** 👁 shown in upcoming · ❓ shown as mystery · nothing = hidden until live. */
const VisibilityIcon = ({ drop }: { drop: AdminDropType }) => {
  if (!drop.showInUpcoming) return null;

  const isMystery = drop.upcomingDisplay === "mystery";
  return (
    <span
      className="text-base leading-none"
      title={isMystery ? "Shown in upcoming as a mystery" : "Shown in upcoming with the item"}
    >
      {isMystery ? "❓" : "👁"}
    </span>
  );
};

export const DropsList = ({
  onSelectDrop,
  onAddDrop,
}: {
  onSelectDrop: (dropId: string) => void;
  onAddDrop: () => void;
}) => {
  const dispatch = useContext(GlobalDispatchContext);
  const [searchParams] = useSearchParams();
  const forceRefreshInventory = searchParams.get("forceRefreshInventory") === "true";

  const [drops, setDrops] = useState<AdminDropType[]>([]);
  const [timezone, setTimezone] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    backendAPI
      .get("/drops", { params: { forceRefreshInventory } })
      .then((response) => {
        setDrops(response.data.drops || []);
        setTimezone(response.data.timezone || "");
      })
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setIsLoading(false));
  }, [dispatch, forceRefreshInventory]);

  return (
    <div>
      <h2 className="text-2xl">Scheduled Drops</h2>
      {timezone && <p className="text-sm text-ink-soft mb-4">Timezone: {timezone}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-soft py-6">Loading drops…</p>
      ) : (
        <>
          {drops.length === 0 && (
            <div className="card text-center py-8 mb-4">
              <h4 className="text-ink-soft mb-1">No drops yet</h4>
              <p className="text-sm text-ink-soft">Add a drop to set up your first unlock challenge.</p>
            </div>
          )}

          <ul className="flex flex-col gap-2 mb-4">
            {drops.map((drop) => {
              const state = drop.state || "always";
              const chip = STATE_CHIP[state];
              const count = drop.stats?.unlockCount ?? 0;

              return (
                <li key={drop.id}>
                  <button
                    className={`drop-row ${state === "live" ? "drop-row-live" : ""}`}
                    onClick={() => onSelectDrop(drop.id)}
                  >
                    <span className="flex-1 min-w-0 text-left">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="flex flex-shrink-0">
                          <ItemThumb
                            name={drop.resolvedItemName}
                            previewUrl={drop.resolvedItemPreviewUrl}
                            unlockType={drop.unlockType}
                            size="xs"
                          />
                        </span>
                        <span className="font-semibold text-secondary truncate">
                          {drop.resolvedItemName || "Untitled drop"}
                        </span>
                      </span>

                      <span className="block text-xs text-ink-soft mt-0.5">
                        {formatDropRange(drop.startDate, drop.endDate)} ·{" "}
                        {QUESTION_TYPE_LABELS[drop.questionType] || drop.questionType}
                      </span>
                      {!drop.isConfigured && (
                        <span className="block text-xs text-primary mt-0.5">Incomplete — not shown to users</span>
                      )}
                    </span>

                    <VisibilityIcon drop={drop} />

                    <span className={`drop-chip ${chip.className}`}>
                      {chip.showCount ? `${chip.label} · ${count}` : chip.label}
                    </span>

                    <span className="text-ink-soft" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <button className="btn-ghost" onClick={onAddDrop}>
            + Add drop
          </button>
        </>
      )}
    </div>
  );
};

export default DropsList;
