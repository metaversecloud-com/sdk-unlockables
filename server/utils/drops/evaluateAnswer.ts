import { Drop } from "../../types/index.js";

/**
 * Judge a user's answer against the drop's stored answer. Runs server-side only — the answer never
 * reaches the client, so this is the single place a correct answer is decided.
 */
export const evaluateAnswer = ({
  drop,
  password,
  selectedAnswers,
}: {
  drop: Drop;
  password?: string;
  selectedAnswers?: number[];
}): boolean => {
  switch (drop.questionType) {
    case "open_text":
      // Any non-empty response unlocks.
      return !!password?.trim();

    case "text":
      if (!password || !drop.password) return false;
      return password.trim().toLowerCase() === drop.password.trim().toLowerCase();

    case "multiple_choice":
      if (!Array.isArray(selectedAnswers) || selectedAnswers.length !== 1) return false;
      if (!Array.isArray(drop.correctAnswers)) return false;
      return selectedAnswers[0] === drop.correctAnswers[0];

    case "all_that_apply": {
      if (!Array.isArray(selectedAnswers) || !Array.isArray(drop.correctAnswers)) return false;
      const selected = [...selectedAnswers].sort();
      const correct = [...drop.correctAnswers].sort();
      return selected.length === correct.length && selected.every((value, index) => value === correct[index]);
    }

    default:
      return false;
  }
};
