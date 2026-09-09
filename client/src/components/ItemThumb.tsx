import { UnlockType } from "@/context/types";

export const DEFAULT_ICONS: Record<UnlockType, string> = {
  emote: "/default-emote-icon.svg",
  accessory: "/default-accessory-icon.svg",
  badge: "/default-badge-icon.svg",
};

export const defaultIconFor = (unlockType?: UnlockType) => DEFAULT_ICONS[unlockType || "emote"];

export const ItemThumb = ({
  name,
  previewUrl,
  unlockType,
  size = "md",
  muted = false,
  frameClassName = "",
}: {
  name?: string;
  previewUrl?: string;
  unlockType?: UnlockType;
  size?: "xs" | "sm" | "md" | "lg";
  muted?: boolean;
  frameClassName?: string;
}) => {
  const dimensions = { xs: "w-5 h-5", sm: "w-12 h-12", md: "w-16 h-16", lg: "w-32 h-32" }[size];

  if (size === "xs") {
    return (
      <div className={`treasure-frame-xs ${frameClassName}`} title={name || undefined}>
        <img
          src={previewUrl || defaultIconFor(unlockType)}
          alt={name || "Unlock reward"}
          className={`${dimensions} object-contain ${muted ? "grayscale opacity-50" : ""}`}
          onError={(event) => {
            const target = event.currentTarget;
            const fallback = defaultIconFor(unlockType);
            if (target.src.endsWith(fallback)) return;
            target.src = fallback;
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`treasure-frame ${muted ? "treasure-frame-muted" : ""} ${frameClassName}`}
      title={name || undefined}
    >
      <div className="treasure-frame-inner">
        <img
          src={previewUrl || defaultIconFor(unlockType)}
          alt={name || "Unlock reward"}
          className={`${dimensions} object-contain ${muted ? "grayscale opacity-50" : ""}`}
          onError={(event) => {
            const target = event.currentTarget;
            const fallback = defaultIconFor(unlockType);
            if (target.src.endsWith(fallback)) return;
            target.src = fallback;
          }}
        />
      </div>
    </div>
  );
};

export default ItemThumb;
