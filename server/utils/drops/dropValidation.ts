import { Drop, QuestionType, UnlockType } from "../../types/index.js";

const UNLOCK_TYPES: UnlockType[] = ["emote", "accessory", "badge"];
const QUESTION_TYPES: QuestionType[] = ["text", "open_text", "multiple_choice", "all_that_apply"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True if the drop names an item to grant. */
export const hasItemSelected = (drop: Partial<Drop>): boolean => {
  if (drop.unlockType === "accessory") return !!drop.accessoryIds?.length;
  if (drop.unlockType === "badge") return !!drop.badgeId;
  return !!drop.itemId;
};

/** True if the drop's answer configuration can actually be evaluated. */
export const hasAnswerConfigured = (drop: Partial<Drop>): boolean => {
  const optionsFilled = (drop.options || []).filter((o) => o?.trim()).length;

  switch (drop.questionType) {
    case "open_text":
      return true;
    case "text":
      return !!drop.password?.trim();
    case "multiple_choice":
      return optionsFilled >= 2 && drop.correctAnswers?.length === 1;
    case "all_that_apply":
      return optionsFilled >= 2 && !!drop.correctAnswers?.length;
    default:
      return false;
  }
};

/**
 * A drop only reaches users once it can both grant something and judge an answer.
 */
export const isDropConfigured = (drop: Partial<Drop>): boolean => hasItemSelected(drop) && hasAnswerConfigured(drop);

/**
 * Validate an admin's drop submission. Returns an error message, or null when the drop is valid.
 */
export const validateDropInput = (drop: Partial<Drop>): string | null => {
  if (!drop.unlockType || !UNLOCK_TYPES.includes(drop.unlockType)) {
    return "Please choose an unlock type.";
  }

  if (!hasItemSelected(drop)) {
    if (drop.unlockType === "accessory") return "Please select at least one accessory.";
    if (drop.unlockType === "badge") return "Please select a badge.";
    return "Please select an emote.";
  }

  if (!drop.questionType || !QUESTION_TYPES.includes(drop.questionType)) {
    return "Please choose a question type.";
  }

  if (!drop.itemDescription?.trim()) {
    return "Please enter a question or description.";
  }

  if (!hasAnswerConfigured(drop)) {
    switch (drop.questionType) {
      case "text":
        return "Please enter the correct answer.";
      case "multiple_choice":
        return "Please add at least two options and mark exactly one as correct.";
      case "all_that_apply":
        return "Please add at least two options and mark at least one as correct.";
      default:
        return "Please complete the answer configuration.";
    }
  }

  if (drop.questionType === "multiple_choice" || drop.questionType === "all_that_apply") {
    const optionCount = (drop.options || []).length;
    const outOfRange = (drop.correctAnswers || []).some((i) => !Number.isInteger(i) || i < 0 || i >= optionCount);
    if (outOfRange) return "A correct answer points at an option that doesn't exist.";
  }

  const { startDate, endDate } = drop;

  if (startDate && !DATE_PATTERN.test(startDate)) return "Start date must be a valid date.";
  if (endDate && !DATE_PATTERN.test(endDate)) return "End date must be a valid date.";

  // endDate is inclusive, so an end equal to the start is a valid single-day window.
  if (startDate && endDate && endDate < startDate) return "End date must be on or after the start date.";

  if (drop.upcomingDisplay && drop.upcomingDisplay !== "item" && drop.upcomingDisplay !== "mystery") {
    return "Invalid upcoming display option.";
  }

  return null;
};
