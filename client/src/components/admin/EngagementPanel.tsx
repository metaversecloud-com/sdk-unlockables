import { useState } from "react";
import { AdminDropType } from "@/context/types";

/** Per-drop engagement. Counts are aggregate; the response table only exists for open responses. */
export const EngagementPanel = ({ drop }: { drop?: AdminDropType }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!drop) return null;

  const responses = Object.entries(drop.responses || {}).sort(([, a], [, b]) =>
    (b.respondedAt || "").localeCompare(a.respondedAt || ""),
  );

  return (
    <div className="admin-section">
      <button className="flex items-center justify-between w-full" onClick={() => setIsOpen(!isOpen)} type="button">
        <h4 className="text-sm font-semibold text-secondary">Engagement</h4>
        <span className="text-ink-soft">{isOpen ? "⌃" : "⌄"}</span>
      </button>

      {isOpen && (
        <>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="stat-card">
              <div className="stat-value">{drop.stats?.attempts ?? 0}</div>
              <div className="stat-label">Attempts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{drop.stats?.unlockCount ?? 0}</div>
              <div className="stat-label">Unlocked</div>
            </div>
          </div>

          <p className="text-xs text-ink-soft mt-2">Stats are per drop.</p>

          {drop.questionType === "open_text" && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-secondary mb-2">Responses ({responses.length})</h4>

              {responses.length === 0 ? (
                <p className="text-sm text-ink-soft">No responses yet.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {responses.map(([profileId, response]) => (
                    <div key={profileId} className="response-row">
                      <span className="font-semibold text-sm">{response.displayName}</span>
                      <span className="text-sm text-ink-soft">{response.response}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EngagementPanel;
