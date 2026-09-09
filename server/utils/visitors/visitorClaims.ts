import { Drop } from "../../types/index.js";

export type VisitorClaims = { [dropId: string]: string };

/**
 * The visitor data object is shared by every app the visitor touches in this world, so this module
 * only ever writes through `updateDataObject` with dotted paths scoped under `claims.<assetKey>`.
 * `setDataObject` is used only when the object is completely empty, where there is nothing to clobber.
 */
const claimsPath = (assetId: string) => {
  // Dots would be read as path separators, splitting one asset's claims across nested keys.
  const assetKey = assetId.replace(/\./g, "_");
  return `claims.${assetKey}`;
};

const buildLockId = (visitorId: number) => `claim-${visitorId}-${Math.round(Date.now() / 60000)}`;

const ensureVisitorDataObject = async (visitor: any) => {
  await visitor.fetchDataObject();

  if (!visitor.dataObject || Object.keys(visitor.dataObject).length === 0) {
    await visitor
      .setDataObject({ claims: {} }, { lock: { lockId: buildLockId(visitor.visitorId), releaseLock: true } })
      .catch(() => console.warn("Unable to acquire lock for visitor data object initialization"));
  }
};

/** Every drop this visitor has claimed on this asset, keyed by drop id. */
export const getVisitorClaims = async (visitor: any, assetId: string): Promise<VisitorClaims> => {
  try {
    await ensureVisitorDataObject(visitor);
    const assetKey = assetId.replace(/\./g, "_");
    return (visitor.dataObject?.claims?.[assetKey] || {}) as VisitorClaims;
  } catch (error) {
    // A missing claim record must never block the app — worst case a claimed drop reappears.
    console.error("Error reading visitor claims", error);
    return {};
  }
};

export const recordVisitorClaim = async (visitor: any, assetId: string, dropId: string): Promise<void> => {
  await ensureVisitorDataObject(visitor);

  await visitor
    .updateDataObject(
      { [`${claimsPath(assetId)}.${dropId}`]: new Date().toISOString() },
      { lock: { lockId: buildLockId(visitor.visitorId), releaseLock: true } },
    )
    .catch((error: any) => console.error("Error recording visitor claim", error));
};

/**
 * Claimed if the visitor's own record says so, or if they unlocked the challenge before the v1 -> v2
 * migration collapsed the per-profile map into an aggregate count.
 */
export const hasClaimedDrop = (claims: VisitorClaims, drop: Drop, profileId: string): boolean =>
  !!claims[drop.id] || !!drop.legacyUnlockedProfileIds?.includes(profileId);
