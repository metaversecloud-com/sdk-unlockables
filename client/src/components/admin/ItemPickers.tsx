import { AccessoryPackOption, BadgeOption, EmoteOption } from "@/context/types";
import { ItemThumb } from "@/components";

export const EmotePicker = ({
  emotes,
  selectedId,
  onSelect,
}: {
  emotes: EmoteOption[];
  selectedId?: string;
  onSelect: (emote?: EmoteOption) => void;
}) => {
  const selected = emotes.find((emote) => emote.id === selectedId);

  return (
    <div className="admin-section">
      <h4 className="text-sm font-semibold text-secondary mb-2">Emote</h4>

      <select
        className="input-treasure"
        value={selectedId || ""}
        onChange={(event) => onSelect(emotes.find((emote) => emote.id === event.target.value))}
      >
        <option value="">Select an emote</option>
        {emotes.map((emote) => (
          <option key={emote.id} value={emote.id}>
            {emote.name}
          </option>
        ))}
      </select>

      {selected && (
        <div className="selected-preview mt-3">
          <ItemThumb name={selected.name} previewUrl={selected.previewUrl} unlockType="emote" size="sm" />
          <span className="font-semibold text-sm">{selected.name}</span>
        </div>
      )}
    </div>
  );
};

export const BadgePicker = ({
  badges,
  selectedId,
  onSelect,
}: {
  badges: BadgeOption[];
  selectedId?: string;
  onSelect: (badge?: BadgeOption) => void;
}) => {
  const selected = badges.find((badge) => badge.id === selectedId);

  return (
    <div className="admin-section">
      <h4 className="text-sm font-semibold text-secondary mb-2">Badge</h4>

      <select
        className="input-treasure"
        value={selectedId || ""}
        onChange={(event) => onSelect(badges.find((badge) => badge.id === event.target.value))}
      >
        <option value="">Select a badge</option>
        {badges.map((badge) => (
          <option key={badge.id} value={badge.id}>
            {badge.name}
          </option>
        ))}
      </select>

      {selected && (
        <div className="selected-preview mt-3">
          <ItemThumb name={selected.name} previewUrl={selected.icon} unlockType="badge" size="sm" />
          <span className="font-semibold text-sm">{selected.name}</span>
        </div>
      )}

      <p className="text-xs text-ink-soft mt-2">One badge per drop.</p>
    </div>
  );
};

export const AccessoryPicker = ({
  packs,
  selectedPackId,
  selectedAccessoryIds,
  onSelectPack,
  onChangeAccessories,
}: {
  packs: AccessoryPackOption[];
  selectedPackId?: string;
  selectedAccessoryIds: string[];
  onSelectPack: (pack?: AccessoryPackOption) => void;
  onChangeAccessories: (ids: string[]) => void;
}) => {
  const selectedPack = packs.find((pack) => pack.id === selectedPackId);
  const accessories = selectedPack?.accessories || [];

  const toggle = (id: string) =>
    onChangeAccessories(
      selectedAccessoryIds.includes(id)
        ? selectedAccessoryIds.filter((existing) => existing !== id)
        : [...selectedAccessoryIds, id],
    );

  return (
    <div className="admin-section">
      <h4 className="text-sm font-semibold text-secondary mb-2">Accessory Pack</h4>

      <select
        className="input-treasure"
        value={selectedPackId || ""}
        onChange={(event) => {
          const pack = packs.find((candidate) => candidate.id === event.target.value);
          onSelectPack(pack);
          // Accessory ids belong to a pack, so switching packs clears the selection.
          onChangeAccessories([]);
        }}
      >
        <option value="">Select a pack</option>
        {packs.map((pack) => (
          <option key={pack.id} value={pack.id}>
            {pack.name} ({pack.accessories.length} items)
          </option>
        ))}
      </select>

      {selectedPack && (
        <>
          <div className="flex items-center justify-between mt-4 mb-2">
            <h4 className="text-sm font-semibold text-secondary">
              Accessories ({selectedAccessoryIds.length}/{accessories.length})
            </h4>
            <div className="flex gap-3 text-sm">
              <button
                className="text-primary font-semibold"
                onClick={() => onChangeAccessories(accessories.map((accessory) => accessory.id))}
              >
                Select all
              </button>
              <button className="text-ink-soft" onClick={() => onChangeAccessories([])}>
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {accessories.map((accessory) => {
              const isSelected = selectedAccessoryIds.includes(accessory.id);

              return (
                <label key={accessory.id} className={`accessory-row ${isSelected ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(accessory.id)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "border-accent bg-accent" : "border-warm-border"
                    }`}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="white"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>

                  <img src={accessory.previewUrl} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium truncate">{accessory.name}</span>
                  {accessory.category && <span className="category-tag">{accessory.category}</span>}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
