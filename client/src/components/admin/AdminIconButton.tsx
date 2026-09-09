export const AdminIconButton = ({
  setShowSettings,
  showSettings,
}: {
  setShowSettings: (value: boolean) => void;
  showSettings: boolean;
}) => {
  return (
    <button
      className="group flex items-center justify-center w-10 h-10 rounded-xl mb-4
                 border-2 border-warm-border bg-surface
                 transition-all duration-200
                 hover:border-primary hover:bg-primary-soft hover:shadow-card"
      onClick={() => setShowSettings(showSettings)}
      title={showSettings ? "Back to challenge" : "Settings"}
    >
      <img
        src={`https://sdk-style.s3.amazonaws.com/icons/${showSettings ? "arrow" : "cog"}.svg`}
        alt={showSettings ? "Back" : "Settings"}
        className={`w-5 h-5 opacity-60 group-hover:opacity-100 transition-all duration-300 ${
          !showSettings ? "group-hover:rotate-90" : ""
        }`}
      />
    </button>
  );
};

export default AdminIconButton;
