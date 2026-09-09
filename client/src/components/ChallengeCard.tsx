import { KeyboardEvent, useContext, useEffect, useState } from "react";
import { GlobalDispatchContext } from "@/context/GlobalContext";
import { SessionUnlock, DropType } from "@/context/types";
import { backendAPI, formatDropDate, setErrorMessage } from "@/utils";
import { ItemThumb, SmallStarIcon } from "@/components";

const WRONG_ANSWER_MESSAGES = [
  "Not quite! Give it another shot.",
  "So close! Try again.",
  "Hmm, that's not it. Keep going!",
  "Almost! One more try?",
  "Nope! But you've got this.",
  "Keep trying, you're getting warmer!",
];

const TYPE_LABELS: Record<string, string> = {
  emote: "Emote",
  accessory: "Accessory",
  badge: "Badge",
};

const CheckMark = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WrongAnswerNote = ({ message }: { message: string }) => (
  <div
    className="flex items-center gap-3 rounded-xl px-4 py-3 animate-fade-up"
    style={{ background: "linear-gradient(135deg, #FFF5EB 0%, #FFF0E6 100%)", border: "1.5px solid #F5CB5C" }}
  >
    <span className="text-xl flex-shrink-0">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#FFF3C4" stroke="#F5CB5C" strokeWidth="1.5" />
        <circle cx="8.5" cy="10" r="1.2" fill="#D4A04A" />
        <circle cx="15.5" cy="10" r="1.2" fill="#D4A04A" />
        <path d="M8.5 16C9.5 14.5 14.5 14.5 15.5 16" stroke="#D4A04A" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
    <p className="text-sm font-medium" style={{ color: "#8B6914" }}>
      {message}
    </p>
  </div>
);

/**
 * One claimable challenge. Self-contained: item preview, question, the answer UI for its question
 * type, and its own unlock counter.
 */
export const ChallengeCard = ({
  drop,
  isPreview = false,
  onUnlocked,
}: {
  drop: DropType;
  isPreview?: boolean;
  onUnlocked?: (sessionUnlock: SessionUnlock) => void;
}) => {
  const dispatch = useContext(GlobalDispatchContext);

  const [password, setPassword] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wrongAttempt, setWrongAttempt] = useState<string | null>(null);
  const [shakeCard, setShakeCard] = useState(false);

  const questionType = drop.questionType || "text";
  const options = drop.options || [];
  const isAccessory = drop.unlockType === "accessory";
  const accessories = drop.accessories || [];
  const typeLabel = TYPE_LABELS[drop.unlockType] || "Reward";
  const isFreeText = questionType === "text" || questionType === "open_text";

  useEffect(() => {
    if (!wrongAttempt) return;
    const timer = setTimeout(() => setWrongAttempt(null), 4000);
    return () => clearTimeout(timer);
  }, [wrongAttempt]);

  const handleUnlockAttempt = async () => {
    if (isPreview) return;

    if (isFreeText && !password.trim()) {
      setErrorMessage(dispatch, "Please enter a response");
      return;
    }
    if (!isFreeText && selectedAnswers.length === 0) {
      setErrorMessage(dispatch, "Please select an answer");
      return;
    }

    setIsSubmitting(true);
    setWrongAttempt(null);

    const body = isFreeText ? { dropId: drop.id, password: password.trim() } : { dropId: drop.id, selectedAnswers };

    await backendAPI
      .post("/unlock/attempt", body)
      .then((response) => {
        setPassword("");
        setSelectedAnswers([]);
        setErrorMessage(dispatch, undefined);
        onUnlocked?.({
          dropId: drop.id,
          grantedNames: response.data?.grantedNames,
          alreadyOwned: response.data?.alreadyOwned,
        });
      })
      .catch((error) => {
        // 400 is the wrong-answer path — shake the card instead of raising the global error toast.
        if (error?.response?.status === 400) {
          setWrongAttempt(WRONG_ANSWER_MESSAGES[Math.floor(Math.random() * WRONG_ANSWER_MESSAGES.length)]);
          setShakeCard(true);
          setTimeout(() => setShakeCard(false), 500);
          setErrorMessage(dispatch, undefined);
        } else {
          setErrorMessage(dispatch, error);
        }
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleUnlockAttempt();
  };

  const toggleOption = (index: number) => {
    if (questionType === "multiple_choice") {
      setSelectedAnswers([index]);
      return;
    }
    setSelectedAnswers((previous) =>
      previous.includes(index) ? previous.filter((i) => i !== index) : [...previous, index],
    );
  };

  return (
    <div>
      <div className={`card flex flex-col gap-5 ${shakeCard ? "animate-shake" : ""}`}>
        <div className="flex items-start justify-between">
          <h4>{typeLabel} Unlock Challenge</h4>
          {drop.state === "always" ? (
            <span className="drop-chip drop-chip-always line-break">Always available</span>
          ) : (
            drop.endDate && <span className="drop-chip drop-chip-live">Ends {formatDropDate(drop.endDate)}</span>
          )}
        </div>
        {isAccessory && accessories.length > 0 ? (
          <div className="flex flex-wrap gap-3 justify-center">
            {accessories.map((accessory) => (
              <div key={accessory.id} className="text-center">
                <ItemThumb name={accessory.name} previewUrl={accessory.previewUrl} unlockType="accessory" />
                <p className="text-xs mt-2 font-medium text-ink-soft">{accessory.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <ItemThumb
              name={drop.itemName}
              previewUrl={drop.itemPreviewUrl}
              unlockType={drop.unlockType}
              size="lg"
              frameClassName="animate-gentle-pulse"
            />
            {drop.itemName && <p className="text-xs pt-1 text-ink-soft">{drop.itemName}</p>}
          </div>
        )}

        <p className="text-center text-ink font-medium leading-relaxed" style={{ whiteSpace: "pre-line" }}>
          {drop.itemDescription ||
            (questionType === "open_text"
              ? `Share your thoughts to unlock this ${typeLabel.toLowerCase()}!`
              : `Enter the correct answer to unlock this ${typeLabel.toLowerCase()}!`)}
        </p>

        {isFreeText ? (
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={questionType === "open_text" ? "Type your response..." : "Type your answer..."}
            className="input-treasure text-center"
            disabled={isSubmitting}
          />
        ) : (
          <div className="grid gap-2.5">
            {options.map((option, index) => (
              <label key={index} className={`option-card ${selectedAnswers.includes(index) ? "selected" : ""}`}>
                <input
                  type={questionType === "multiple_choice" ? "radio" : "checkbox"}
                  name={`answer-${drop.id}`}
                  checked={selectedAnswers.includes(index)}
                  onChange={() => toggleOption(index)}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedAnswers.includes(index) ? "border-accent bg-accent" : "border-warm-border"
                  }`}
                >
                  {selectedAnswers.includes(index) && <CheckMark />}
                </div>
                <span className="font-medium text-sm">{option}</span>
              </label>
            ))}
          </div>
        )}

        {wrongAttempt && <WrongAnswerNote message={wrongAttempt} />}

        <button className="btn-treasure text-base" onClick={handleUnlockAttempt} disabled={isSubmitting || isPreview}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-loader" />
              Checking...
            </span>
          ) : (
            `Unlock ${typeLabel}`
          )}
        </button>

        {isPreview && <p className="text-center text-xs text-ink-soft">Preview only — answers aren't submitted.</p>}

        {typeof drop.unlockCount === "number" && (
          <div className="flex justify-center">
            <div className="stats-badge">
              <SmallStarIcon />
              {drop.unlockCount} users unlocked
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallengeCard;
