import { Credentials, Drop } from "../../types/index.js";
import { errorHandler } from "../errorHandler.js";
import { Ecosystem } from "../topiaInit.js";

export interface GrantResult {
  /** The visitor already owned the reward — no particle, no grant analytics. */
  alreadyOwned: boolean;
  /** Display names of what was granted, for the toast. */
  grantedNames: string[];
}

const swallow = (functionName: string, message: string) => (error: any) =>
  errorHandler({ error, functionName, message });

const celebrate = (visitor: any, title: string, text: string) => {
  visitor.fireToast({ title, text }).catch(swallow("grantDropReward", "Error firing toast"));
  visitor
    .triggerParticle({ name: "Sparkle", duration: 3 })
    .catch(swallow("grantDropReward", "Error triggering particle effects"));
};

const alreadyUnlockedToast = (visitor: any, text: string) => {
  visitor.fireToast({ title: "Already Unlocked", text }).catch(swallow("grantDropReward", "Error firing toast"));
};

const statusOf = (error: any): number | undefined => error?.status || error?.statusCode;

/**
 * Grant metadata is fetched fresh rather than read from the 6-hour inventory cache, so an item
 * published moments ago still grants correctly.
 */
const fetchFreshInventoryItems = async (credentials: Credentials): Promise<any[]> => {
  const { assetId, interactiveNonce, interactivePublicKey, urlSlug, visitorId } = credentials;
  const ecosystem = Ecosystem.create({
    credentials: { assetId, interactiveNonce, interactivePublicKey, urlSlug, visitorId },
  });
  await ecosystem.fetchInventoryItems();
  return (ecosystem.inventoryItems as any[]) || [];
};

const grantEmote = async (visitor: any, drop: Drop): Promise<GrantResult> => {
  const response = await visitor
    .grantExpression({ id: drop.itemId })
    .catch((error: any) => console.error("Unlock with itemId failed", error?.message));

  const name = drop.itemName || "emote";

  if (response?.statusCode === 409) {
    alreadyUnlockedToast(visitor, "You've already unlocked this emote! Click on your avatar to use it.");
    return { alreadyOwned: true, grantedNames: [name] };
  }

  celebrate(visitor, "Congrats! Emote Unlocked", "You just unlocked a new emote! Click on your avatar to test it out.");
  return { alreadyOwned: false, grantedNames: [name] };
};

const grantAccessories = async (credentials: Credentials, visitor: any, drop: Drop): Promise<GrantResult> => {
  const accessoryIds = drop.accessoryIds || [];
  if (!accessoryIds.length) throw new Error("No accessories configured for this drop");

  const inventoryItems = await fetchFreshInventoryItems(credentials);
  const items = accessoryIds.map((id) => inventoryItems.find((item) => item.id === id)).filter(Boolean);

  if (!items.length) throw new Error("Accessories not found in inventory catalog");

  const names = items.map((item: any) => item.metadata?.displayName || item.name || "Accessory");

  try {
    // Sequential to avoid API lock contention.
    for (const item of items) await visitor.grantInventoryItem(item, 1);
  } catch (error: any) {
    if (statusOf(error) === 409) {
      alreadyUnlockedToast(visitor, "You've already unlocked these accessories!");
      return { alreadyOwned: true, grantedNames: names };
    }
    throw error;
  }

  const count = items.length;
  celebrate(
    visitor,
    "Congrats! Accessories Unlocked",
    `You just unlocked ${count} new accessor${count === 1 ? "y" : "ies"}!`,
  );
  return { alreadyOwned: false, grantedNames: names };
};

const grantBadge = async (credentials: Credentials, visitor: any, drop: Drop): Promise<GrantResult> => {
  if (!drop.badgeId) throw new Error("No badge configured for this drop");

  const inventoryItems = await fetchFreshInventoryItems(credentials);
  const badge = inventoryItems.find((item) => item.id === drop.badgeId && item.type === "BADGE");

  if (!badge) throw new Error("Badge not found in inventory catalog");

  const name = badge.name || drop.badgeName || "badge";

  try {
    await visitor.grantInventoryItem(badge, 1);
  } catch (error: any) {
    if (statusOf(error) === 409) {
      alreadyUnlockedToast(visitor, `You've already earned the ${name} badge!`);
      return { alreadyOwned: true, grantedNames: [name] };
    }
    throw error;
  }

  celebrate(visitor, "Congrats! Badge Unlocked", `You just earned the ${name} badge!`);
  return { alreadyOwned: false, grantedNames: [name] };
};

/**
 * Grant a drop's reward and fire the in-world feedback. Throws on anything other than an
 * already-owned (409) response, which the caller surfaces as a 500.
 */
export const grantDropReward = async ({
  credentials,
  visitor,
  drop,
}: {
  credentials: Credentials;
  visitor: any;
  drop: Drop;
}): Promise<GrantResult> => {
  if (drop.unlockType === "accessory") return grantAccessories(credentials, visitor, drop);
  if (drop.unlockType === "badge") return grantBadge(credentials, visitor, drop);
  return grantEmote(visitor, drop);
};
