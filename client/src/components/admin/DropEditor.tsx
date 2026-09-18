import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GlobalDispatchContext } from "@/context/GlobalContext";
import {
  AccessoryPackOption,
  AdminDropType,
  BadgeOption,
  EmoteOption,
  ErrorType,
  QuestionType,
  DropType,
  UnlockType,
  UpcomingDisplay,
} from "@/context/types";
import { backendAPI, setErrorMessage } from "@/utils";
import { AnswerBuilder, ChallengeCard, ConfirmationModal, EngagementPanel, ItemThumb } from "@/components";
import { AccessoryPicker, BadgePicker, EmotePicker } from "./ItemPickers";

const UNLOCK_TYPE_OPTIONS: { value: UnlockType; label: string }[] = [
  { value: "emote", label: "Emote" },
  { value: "accessory", label: "Avatar Accessory" },
  { value: "badge", label: "Badge" },
];

export const DropEditor = ({ dropId, onBack, onDone }: { dropId?: string; onBack: () => void; onDone: () => void }) => {
  const dispatch = useContext(GlobalDispatchContext);
  const [searchParams] = useSearchParams();
  const forceRefreshInventory = searchParams.get("forceRefreshInventory") === "true";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [existingDrop, setExistingDrop] = useState<AdminDropType | undefined>();
  const [emotes, setEmotes] = useState<EmoteOption[]>([]);
  const [packs, setPacks] = useState<AccessoryPackOption[]>([]);
  const [badges, setBadges] = useState<BadgeOption[]>([]);

  // ---- editor state -------------------------------------------------------------------------
  const [unlockType, setUnlockType] = useState<UnlockType>("emote");
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPreviewUrl, setItemPreviewUrl] = useState("");
  const [packId, setPackId] = useState("");
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  // Accessory drops let the admin pick a single icon for the challenge card
  // from the pack image or any of the currently-selected accessories. The
  // value flows through to `itemPreviewUrl` at save time — no separate field
  // on Drop.
  const [challengePreviewUrl, setChallengePreviewUrl] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [badgeName, setBadgeName] = useState("");
  const [badgeIcon, setBadgeIcon] = useState("");
  // Admin-authored title. Stored empty while auto-tracking the item name;
  // once the admin types a custom value it wins. `effectiveChallengeName`
  // below is the value the user actually sees — it falls back to the item
  // name whenever `customChallengeName` is blank.
  const [customChallengeName, setCustomChallengeName] = useState("");
  // Custom-dropdown open state for the Challenge Preview Icon picker. Native
  // <select> options can't carry images so we render our own listbox.
  const [previewIconOpen, setPreviewIconOpen] = useState(false);
  const previewIconRef = useRef<HTMLDivElement>(null);
  const [itemDescription, setItemDescription] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("text");
  const [password, setPassword] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([]);
  // New-drop defaults: a scheduled, teased drop is the common case. Editing an existing drop
  // overwrites all of these from the saved record below, so these only apply when dropId is absent.
  const [alwaysAvailable, setAlwaysAvailable] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showInUpcoming, setShowInUpcoming] = useState(true);
  const [upcomingDisplay, setUpcomingDisplay] = useState<UpcomingDisplay>("item");

  useEffect(() => {
    const requests = [backendAPI.get("/unlockables", { params: { forceRefreshInventory } })];
    if (dropId) requests.push(backendAPI.get("/drops", { params: { forceRefreshInventory } }));

    Promise.all(requests)
      .then(([unlockables, dropsResponse]) => {
        setEmotes(unlockables.data.emotes || []);
        setPacks(unlockables.data.packs || []);
        setBadges(unlockables.data.badges || []);

        if (!dropId) return;

        const drop: AdminDropType | undefined = (dropsResponse?.data?.drops || []).find(
          (candidate: AdminDropType) => candidate.id === dropId,
        );
        if (!drop) return;

        setExistingDrop(drop);
        setUnlockType(drop.unlockType);
        setItemId(drop.itemId || "");
        setItemName(drop.itemName || "");
        setItemPreviewUrl(drop.itemPreviewUrl || "");
        // For accessory drops the stored itemPreviewUrl is whichever icon
        // (pack or specific accessory) the admin chose last. Rehydrate the
        // dropdown state from it; the sync effect below will validate it
        // against the current pack + selected accessories on next render.
        setChallengePreviewUrl(drop.itemPreviewUrl || "");
        setPackId(drop.packId || "");
        setAccessoryIds(drop.accessoryIds || []);
        setBadgeId(drop.badgeId || "");
        setBadgeName(drop.badgeName || "");
        setBadgeIcon(drop.badgeIcon || "");
        setItemDescription(drop.itemDescription || "");
        // Only treat as "custom" when the stored challengeName differs from
        // the item name; identical means the admin let it default and we
        // should keep auto-tracking future item changes.
        const autoName = drop.unlockType === "badge" ? drop.badgeName || "" : drop.itemName || "";
        setCustomChallengeName(drop.challengeName && drop.challengeName !== autoName ? drop.challengeName : "");
        setQuestionType(drop.questionType);
        setPassword(drop.password || "");
        setOptions(drop.options?.length ? drop.options : ["", ""]);
        setCorrectAnswers(drop.correctAnswers || []);
        setAlwaysAvailable(!drop.startDate && !drop.endDate);
        setStartDate(drop.startDate || "");
        setEndDate(drop.endDate || "");
        setShowInUpcoming(drop.showInUpcoming);
        setUpcomingDisplay(drop.upcomingDisplay || "item");
      })
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setIsLoading(false));
  }, [dropId, dispatch, forceRefreshInventory]);

  // Switching question type clears the previous answer so nothing stale is submitted.
  const handleQuestionTypeChange = (next: QuestionType) => {
    setQuestionType(next);
    setPassword("");
    setOptions(["", ""]);
    setCorrectAnswers([]);
  };

  const selectedPack = packs.find((pack) => pack.id === packId);

  // The item name that would default the challenge name if the admin hasn't
  // typed one in. Accessory packs use the pack's name; emote/badge use their
  // own name states set by the pickers.
  const autoChallengeName =
    unlockType === "accessory" ? selectedPack?.name || "" : unlockType === "badge" ? badgeName : itemName;
  const effectiveChallengeName = customChallengeName.trim() || autoChallengeName;

  // Options for the "Challenge Preview Icon" dropdown: the pack image plus
  // any currently-selected accessory. Rebuilt whenever the pack changes or
  // the selected accessories change. Each option carries its own thumb URL
  // and (for accessories) a category label — packs have no category.
  type PreviewIconOption = { url: string; label: string; previewUrl: string; category?: string };
  const previewIconOptions = useMemo<PreviewIconOption[]>(() => {
    if (unlockType !== "accessory" || !selectedPack) return [];
    const options: PreviewIconOption[] = [];
    if (selectedPack.previewUrl) {
      options.push({
        url: selectedPack.previewUrl,
        label: `${selectedPack.name} (pack)`,
        previewUrl: selectedPack.previewUrl,
      });
    }
    for (const accessory of selectedPack.accessories || []) {
      if (accessoryIds.includes(accessory.id) && accessory.previewUrl) {
        options.push({
          url: accessory.previewUrl,
          label: accessory.name,
          previewUrl: accessory.previewUrl,
          category: accessory.category,
        });
      }
    }
    return options;
  }, [unlockType, selectedPack, accessoryIds]);
  const selectedPreviewIcon = previewIconOptions.find((option) => option.url === challengePreviewUrl);

  // Close the preview-icon dropdown on outside click or Escape.
  useEffect(() => {
    if (!previewIconOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (previewIconRef.current && !previewIconRef.current.contains(event.target as Node)) {
        setPreviewIconOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewIconOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [previewIconOpen]);

  // Keep the admin's icon choice valid. If the current selection isn't in
  // the options list (pack switched, or the chosen accessory was deselected)
  // fall back to the first option — the pack image, or the only remaining
  // accessory, or empty when no options exist.
  useEffect(() => {
    if (unlockType !== "accessory") return;
    if (previewIconOptions.length === 0) {
      if (challengePreviewUrl) setChallengePreviewUrl("");
      return;
    }
    if (!previewIconOptions.some((option) => option.url === challengePreviewUrl)) {
      setChallengePreviewUrl(previewIconOptions[0].url);
    }
  }, [unlockType, previewIconOptions, challengePreviewUrl]);

  const previewDrop: DropType = useMemo(() => {
    const accessories = (selectedPack?.accessories || []).filter((accessory) => accessoryIds.includes(accessory.id));

    const resolved = {
      emote: { name: itemName, preview: itemPreviewUrl },
      accessory: {
        name: selectedPack?.name || itemName,
        // Accessory challenge card shows the admin-chosen preview icon (pack
        // image or one of the selected accessories), not the pack image
        // unconditionally.
        preview: challengePreviewUrl || selectedPack?.previewUrl || itemPreviewUrl,
      },
      badge: { name: badgeName, preview: badgeIcon },
    }[unlockType];

    return {
      id: dropId || "preview",
      state: alwaysAvailable ? "always" : "live",
      unlockType,
      challengeName: effectiveChallengeName,
      itemName: resolved.name,
      itemPreviewUrl: resolved.preview,
      accessories: unlockType === "accessory" ? accessories : undefined,
      itemDescription,
      questionType,
      options: questionType === "multiple_choice" || questionType === "all_that_apply" ? options : undefined,
      unlockCount: existingDrop?.stats?.unlockCount ?? 0,
      endDate: alwaysAvailable ? null : endDate,
    };
  }, [
    accessoryIds,
    alwaysAvailable,
    badgeIcon,
    badgeName,
    challengePreviewUrl,
    dropId,
    effectiveChallengeName,
    endDate,
    existingDrop,
    itemDescription,
    itemName,
    itemPreviewUrl,
    options,
    questionType,
    selectedPack,
    unlockType,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    setValidationError("");

    const body = {
      unlockType,
      // Blank customChallengeName means "default to the item name" — send the
      // resolved value so the server persists a non-empty title.
      challengeName: effectiveChallengeName,
      itemId: unlockType === "emote" ? itemId : undefined,
      itemName: unlockType === "accessory" ? selectedPack?.name : unlockType === "emote" ? itemName : undefined,
      itemPreviewUrl:
        unlockType === "accessory"
          ? challengePreviewUrl || selectedPack?.previewUrl
          : unlockType === "emote"
            ? itemPreviewUrl
            : undefined,
      packId: unlockType === "accessory" ? packId : undefined,
      accessoryIds: unlockType === "accessory" ? accessoryIds : undefined,
      badgeId: unlockType === "badge" ? badgeId : undefined,
      badgeName: unlockType === "badge" ? badgeName : undefined,
      badgeIcon: unlockType === "badge" ? badgeIcon : undefined,
      itemDescription,
      questionType,
      password,
      options,
      correctAnswers,
      alwaysAvailable,
      startDate: alwaysAvailable ? null : startDate,
      endDate: alwaysAvailable ? null : endDate,
      showInUpcoming,
      upcomingDisplay,
    };

    const request = dropId ? backendAPI.put(`/drops/${dropId}`, body) : backendAPI.post("/drops", body);

    await request
      .then(() => onDone())
      .catch((error) => {
        // Validation failures are the admin's to fix inline; anything else is a real error.
        const message = error?.response?.data?.message;
        if (error?.response?.status === 400 && message) setValidationError(message);
        else setErrorMessage(dispatch, error as ErrorType);
      })
      .finally(() => setIsSaving(false));
  };

  const handleDuplicate = async () => {
    if (!dropId) return;
    setIsSaving(true);

    await backendAPI
      .post(`/drops/${dropId}/duplicate`)
      .then(() => onDone())
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setIsSaving(false));
  };

  const handleDelete = async () => {
    if (!dropId) return;

    setIsSaving(true);

    await backendAPI
      .delete(`/drops/${dropId}`)
      .then(() => onDone())
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setIsSaving(false));
  };

  if (isLoading) return <p className="text-sm text-ink-soft py-6">Loading configuration…</p>;

  if (showPreview) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl">Preview</h2>
          <button className="btn-ghost" onClick={() => setShowPreview(false)}>
            Back to editor
          </button>
        </div>
        <p className="text-sm text-ink-soft mb-4">Exactly how someone sees this drop during its window.</p>
        <ChallengeCard drop={previewDrop} isPreview />
      </div>
    );
  }

  return (
    <div>
      <div className="flex">
        <h2 className="flex-grow text-2xl">Configuration</h2>
        <button
          className="group flex items-center justify-center w-10 h-10 rounded-xl mb-4
                 border-2 border-warm-border bg-surface"
          onClick={onBack}
          title="Back to scheduled drops"
        >
          <img
            src="https://sdk-style.s3.amazonaws.com/icons/x.svg"
            className={`w-5 h-5 opacity-60 group-hover:opacity-100 transition-all duration-300`}
          />
        </button>
      </div>
      <p className="text-sm text-ink-soft mb-4">Set up an unlock challenge.</p>
      <div className="flex flex-col gap-4">
        {/* Unlock window */}
        <div className="admin-section admin-section-highlight">
          <h4 className="text-sm font-semibold text-secondary mb-2">Unlock Window</h4>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alwaysAvailable}
              onChange={(event) => setAlwaysAvailable(event.target.checked)}
            />
            <span className="text-sm font-medium">Always available (no dates)</span>
          </label>

          {!alwaysAvailable && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <input
                type="date"
                className="input-treasure"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <input
                type="date"
                className="input-treasure"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          )}
        </div>

        {/* Show in upcoming */}
        <div className="admin-section admin-section-highlight">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInUpcoming}
              onChange={(event) => setShowInUpcoming(event.target.checked)}
            />
            <span className="text-sm font-semibold text-secondary">Show in upcoming challenges</span>
          </label>

          {showInUpcoming && (
            <div className="flex flex-col gap-2 mt-3 ml-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="upcomingDisplay"
                  checked={upcomingDisplay === "item"}
                  onChange={() => setUpcomingDisplay("item")}
                />
                <span className="text-sm">Show the item</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="upcomingDisplay"
                  checked={upcomingDisplay === "mystery"}
                  onChange={() => setUpcomingDisplay("mystery")}
                />
                <span className="text-sm">Mystery (type + dates only)</span>
              </label>
            </div>
          )}
        </div>

        {/* Unlock type */}
        <div className="admin-section">
          <h4 className="text-sm font-semibold text-secondary mb-2">Unlock Type</h4>
          <select
            className="input-treasure"
            value={unlockType}
            onChange={(event) => setUnlockType(event.target.value as UnlockType)}
          >
            {UNLOCK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Item picker */}
        {unlockType === "emote" && (
          <EmotePicker
            emotes={emotes}
            selectedId={itemId}
            onSelect={(emote) => {
              setItemId(emote?.id || "");
              setItemName(emote?.name || "");
              setItemPreviewUrl(emote?.previewUrl || "");
            }}
          />
        )}

        {unlockType === "accessory" && (
          <AccessoryPicker
            packs={packs}
            selectedPackId={packId}
            selectedAccessoryIds={accessoryIds}
            onSelectPack={(pack) => setPackId(pack?.id || "")}
            onChangeAccessories={setAccessoryIds}
          />
        )}

        {/* Challenge preview icon (accessory only) */}
        {unlockType === "accessory" && previewIconOptions.length > 0 && (
          <div className="admin-section">
            <h4 className="text-sm font-semibold text-secondary mb-2">Challenge Preview Icon</h4>
            <div ref={previewIconRef} className="relative">
              <button
                type="button"
                className="input-treasure flex items-center gap-3 w-full text-left"
                aria-haspopup="listbox"
                aria-expanded={previewIconOpen}
                onClick={() => setPreviewIconOpen((open) => !open)}
              >
                {selectedPreviewIcon ? (
                  <>
                    <img
                      src={selectedPreviewIcon.previewUrl}
                      alt=""
                      className="w-7 h-7 rounded object-contain flex-shrink-0"
                    />
                    <span className="flex-1 truncate">{selectedPreviewIcon.label}</span>
                    {selectedPreviewIcon.category && (
                      <span className="text-xs text-ink-soft flex-shrink-0">({selectedPreviewIcon.category})</span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-soft">Select an icon</span>
                )}
                <span aria-hidden="true" className="ml-auto text-ink-soft">▾</span>
              </button>

              {previewIconOpen && (
                <ul
                  role="listbox"
                  className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-warm-border bg-surface shadow-lg"
                >
                  {previewIconOptions.map((option) => {
                    const isSelected = option.url === challengePreviewUrl;
                    return (
                      <li key={option.url}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-warm-border/40 ${
                            isSelected ? "bg-warm-border/30" : ""
                          }`}
                          onClick={() => {
                            setChallengePreviewUrl(option.url);
                            setPreviewIconOpen(false);
                          }}
                        >
                          <img
                            src={option.previewUrl}
                            alt=""
                            className="w-7 h-7 rounded object-contain flex-shrink-0"
                          />
                          <span className="flex-1 truncate">{option.label}</span>
                          {option.category && (
                            <span className="text-xs text-ink-soft flex-shrink-0">({option.category})</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {challengePreviewUrl && (
              <div className="flex justify-center mt-3">
                <ItemThumb name="Challenge preview" previewUrl={challengePreviewUrl} unlockType="accessory" size="sm" />
              </div>
            )}
            <p className="text-xs text-ink-soft mt-2">Shown as the icon on the challenge card.</p>
          </div>
        )}

        {unlockType === "badge" && (
          <BadgePicker
            badges={badges}
            selectedId={badgeId}
            onSelect={(badge) => {
              setBadgeId(badge?.id || "");
              setBadgeName(badge?.name || "");
              setBadgeIcon(badge?.icon || "");
            }}
          />
        )}

        {/* Challenge name */}
        <div className="admin-section">
          <h4 className="text-sm font-semibold text-secondary mb-2">
            Challenge Name <span className="text-danger">*</span>
          </h4>
          <input
            type="text"
            className="input-treasure"
            value={customChallengeName}
            onChange={(event) => setCustomChallengeName(event.target.value)}
            placeholder={autoChallengeName || "Enter a name for this challenge"}
            required
          />
          {!customChallengeName.trim() && autoChallengeName && (
            <p className="text-xs text-ink-soft mt-1">Defaults to “{autoChallengeName}”.</p>
          )}
        </div>

        {/* Question */}
        <div className="admin-section">
          <h4 className="text-sm font-semibold text-secondary mb-2">Question / Description</h4>
          <textarea
            className="input-treasure"
            rows={3}
            value={itemDescription}
            onChange={(event) => setItemDescription(event.target.value)}
          />
        </div>

        <AnswerBuilder
          questionType={questionType}
          password={password}
          options={options}
          correctAnswers={correctAnswers}
          onChangeQuestionType={handleQuestionTypeChange}
          onChangePassword={setPassword}
          onChangeOptions={setOptions}
          onChangeCorrectAnswers={setCorrectAnswers}
        />

        {validationError && <div className="error-toast">{validationError}</div>}

        <button className="btn-treasure" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Configuration"}
        </button>

        <div className="flex flex-wrap gap-1">
          {dropId && (
            <button className="btn-ghost" onClick={handleDuplicate} disabled={isSaving}>
              Duplicate
            </button>
          )}
          <button className="btn-ghost" onClick={() => setShowPreview(true)}>
            Preview
          </button>
          {dropId && (
            <button
              className="btn-ghost btn-ghost-danger"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={isSaving}
            >
              Delete
            </button>
          )}
        </div>

        <EngagementPanel drop={existingDrop} />
      </div>

      {showDeleteConfirmation && (
        <ConfirmationModal
          title="Delete this drop?"
          message="Users who already unlocked it keep their reward."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          handleOnConfirm={handleDelete}
          handleToggleShowConfirmationModal={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
};

export default DropEditor;
