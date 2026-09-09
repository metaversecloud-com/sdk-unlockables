import { QuestionType } from "@/context/types";

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text Answer" },
  { value: "open_text", label: "Open Response (any answer unlocks)" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "all_that_apply", label: "All That Apply" },
];

/**
 * Question type plus the answer fields it implies. Switching type resets the answer, so a leftover
 * password can't linger behind a multiple-choice question.
 */
export const AnswerBuilder = ({
  questionType,
  password,
  options,
  correctAnswers,
  onChangeQuestionType,
  onChangePassword,
  onChangeOptions,
  onChangeCorrectAnswers,
}: {
  questionType: QuestionType;
  password: string;
  options: string[];
  correctAnswers: number[];
  onChangeQuestionType: (questionType: QuestionType) => void;
  onChangePassword: (password: string) => void;
  onChangeOptions: (options: string[]) => void;
  onChangeCorrectAnswers: (correctAnswers: number[]) => void;
}) => {
  const isMultipleChoice = questionType === "multiple_choice";
  const isAllThatApply = questionType === "all_that_apply";

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    onChangeOptions(next);
  };

  const handleRemoveOption = (index: number) => {
    onChangeOptions(options.filter((_, i) => i !== index));
    // Correct answers are option indices, so removing an option shifts everything after it.
    onChangeCorrectAnswers(
      correctAnswers.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
    );
  };

  const handleToggleCorrect = (index: number) => {
    if (isMultipleChoice) {
      onChangeCorrectAnswers([index]);
      return;
    }
    onChangeCorrectAnswers(
      correctAnswers.includes(index) ? correctAnswers.filter((i) => i !== index) : [...correctAnswers, index],
    );
  };

  return (
    <>
      <div className="admin-section">
        <h4 className="text-sm font-semibold text-secondary mb-2">Question Type</h4>
        <select
          className="input-treasure"
          value={questionType}
          onChange={(event) => onChangeQuestionType(event.target.value as QuestionType)}
        >
          {QUESTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-section">
        <h4 className="text-sm font-semibold text-secondary mb-2">Answer</h4>

        {questionType === "open_text" && (
          <p className="answer-note">Users can type anything. Every response grants the unlock.</p>
        )}

        {questionType === "text" && (
          <input
            type="text"
            className="input-treasure"
            value={password}
            onChange={(event) => onChangePassword(event.target.value)}
            placeholder="Correct answer"
          />
        )}

        {(isMultipleChoice || isAllThatApply) && (
          <>
            <p className="text-sm text-ink-soft mb-3">
              Add options and select {isMultipleChoice ? "the one correct answer" : "every correct answer"}.
            </p>

            <div className="flex flex-col gap-2">
              {options.map((option, index) => {
                const isCorrect = correctAnswers.includes(index);

                return (
                  <div key={index} className="flex items-center gap-2">
                    <button
                      className={`correct-toggle ${isCorrect ? "correct" : ""}`}
                      onClick={() => handleToggleCorrect(index)}
                      title={isCorrect ? "Correct answer" : "Mark as correct"}
                      type="button"
                    >
                      {isCorrect ? "✓" : ""}
                    </button>

                    <input
                      type="text"
                      className="input-treasure flex-1"
                      value={option}
                      onChange={(event) => handleOptionChange(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />

                    {options.length > 2 && (
                      <button
                        className="text-ink-soft px-2"
                        onClick={() => handleRemoveOption(index)}
                        title="Remove option"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="text-primary font-semibold text-sm mt-3" onClick={() => onChangeOptions([...options, ""])} type="button">
              + Add Option
            </button>

            {correctAnswers.length > 0 && (
              <p className="answer-note answer-note-success mt-3">
                ✓ Correct: {correctAnswers.map((index) => options[index]).filter(Boolean).join(", ")}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AnswerBuilder;
