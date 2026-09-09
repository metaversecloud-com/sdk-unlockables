import { SessionUnlock, DropType } from "@/context/types";
import { ConfettiCelebration, StarIcon, ItemThumb } from "@/components";

const HEADINGS: Record<string, string> = {
  emote: "Emote Unlocked!",
  accessory: "Accessories Unlocked!",
  badge: "Badge Unlocked!",
};

export const SuccessCard = ({ drop, sessionUnlock }: { drop: DropType; sessionUnlock?: SessionUnlock }) => {
  const accessories = drop.accessories || [];
  const isAccessory = drop.unlockType === "accessory";
  const showAccessoryGrid = isAccessory && accessories.length > 0;
  const count = accessories.length || 1;

  const message = () => {
    if (drop.unlockType === "badge") {
      return (
        <>
          You've earned the <strong>{drop.itemName}</strong> badge!
        </>
      );
    }

    if (isAccessory) {
      return `You've unlocked ${count} new accessor${count === 1 ? "y" : "ies"}! Customize your avatar to use ${
        count === 1 ? "it" : "them"
      }. You may need to reload the page.`;
    }

    return (
      <>
        You've unlocked the <strong>{drop.itemName}</strong> emote. Click on your avatar to use it!
      </>
    );
  };

  return (
    <div
      className="relative card text-center py-8 overflow-hidden animate-bounce-in"
      style={{ background: "linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 50%, #FFF3C4 100%)" }}
    >
      <ConfettiCelebration />

      <div className="relative z-10">
        <div className="mb-3">
          <StarIcon />
        </div>

        <h3 className="pb-4 text-success">{HEADINGS[drop.unlockType] || "Unlocked!"}</h3>

        {showAccessoryGrid ? (
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            {accessories.map((accessory) => (
              <div key={accessory.id} className="text-center">
                <ItemThumb
                  name={accessory.name}
                  previewUrl={accessory.previewUrl}
                  unlockType="accessory"
                  frameClassName="treasure-frame-success"
                />
                <p className="text-xs mt-1.5 font-semibold text-success">{accessory.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <ItemThumb
              name={drop.itemName}
              previewUrl={drop.itemPreviewUrl}
              unlockType={drop.unlockType}
              frameClassName="treasure-frame-success"
            />
            <p className="text-sm mt-1.5 font-semibold text-success">{drop.itemName}</p>
          </div>
        )}

        <p className="text-sm text-ink-soft max-w-xs mx-auto leading-relaxed">
          {sessionUnlock?.alreadyOwned ? "You already had this one — it's yours to keep." : message()}
        </p>
      </div>
    </div>
  );
};

export default SuccessCard;
