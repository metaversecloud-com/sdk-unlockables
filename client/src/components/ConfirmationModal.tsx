import { useEffect, useState } from "react";

/**
 * Standard confirmation dialog. Always use this instead of `window.confirm` — the native dialog is
 * blocking, unstyleable, and inside the Topia drawer iframe it renders chrome the user doesn't
 * associate with the app.
 *
 * Prop names match the shared pattern in sdk-ai-boilerplate so the component is portable between
 * apps; `confirmLabel` / `cancelLabel` are optional and default to Yes/No.
 */
export const ConfirmationModal = ({
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  handleOnConfirm,
  handleToggleShowConfirmationModal,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  handleOnConfirm: () => void;
  handleToggleShowConfirmationModal: () => void;
}) => {
  const [areButtonsDisabled, setAreButtonsDisabled] = useState(false);

  // Escape dismisses, matching what the native confirm dialog allowed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleToggleShowConfirmationModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleToggleShowConfirmationModal]);

  const onConfirm = () => {
    setAreButtonsDisabled(true);
    handleOnConfirm();
    handleToggleShowConfirmationModal();
  };

  return (
    <div className="modal-container" onClick={handleToggleShowConfirmationModal}>
      {/* Stop clicks inside the dialog from reaching the backdrop's dismiss handler. */}
      <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h4>{title}</h4>
        <p className="text-sm text-ink-soft">{message}</p>
        <div className="actions">
          <button className="btn-ghost" onClick={handleToggleShowConfirmationModal} disabled={areButtonsDisabled}>
            {cancelLabel}
          </button>
          <button className="btn-ghost btn-ghost-danger" onClick={onConfirm} disabled={areButtonsDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
