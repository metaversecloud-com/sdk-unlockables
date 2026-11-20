import { Drop } from "../../types/index.js";

export type VisitorClaims = { [dropId: string]: string | null };

/**
 * The visitor data object is shared by every app the visitor touches in this world, so this module
 * only ever writes through `updateDataObject` with dotted paths scoped under `claims.<assetKey>` /
 * `claimRetries.<assetKey>`. `setDataObject` is used only when the object is completely empty, where
 * there is nothing to clobber.
 */

// Dots would be read as path separators, splitting one asset's claims across nested keys.
const toAssetKey = (assetId: string) => assetId.replace(/\./g, "_");

const claimsPath = (assetId: string) => `claims.${toAssetKey(assetId)}`;
const claimRetriesPath = (assetId: string) => `claimRetries.${toAssetKey(assetId)}`;

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
    return (visitor.dataObject?.claims?.[toAssetKey(assetId)] || {}) as VisitorClaims;
  } catch (error) {
    // A missing claim record must never block the app — worst case a claimed drop reappears.
    console.error("Error reading visitor claims", error);
    return {};
  }
};

/**
 * No lock: a dotted-path update can't clobber sibling keys, and public-api silently skips (rather than
 * rejects) a visitor/user write whose lock is already held, which would quietly lose the claim record.
 */
export const recordVisitorClaim = async (visitor: any, assetId: string, dropId: string): Promise<void> => {
  await ensureVisitorDataObject(visitor);

  await visitor
    .updateDataObject({ [`${claimsPath(assetId)}.${dropId}`]: new Date().toISOString() })
    .catch((error: any) => console.error("Error recording visitor claim", error));
};

/**
 * How many times this visitor's claim on the drop was reserved and then rolled back because the grant
 * failed. It is part of the claim lock id, so a rolled-back claim can be reserved again. Reads the data
 * object already loaded by `getVisitorClaims`.
 */
export const getClaimGeneration = (visitor: any, assetId: string, dropId: string): number =>
  Number(visitor?.dataObject?.claimRetries?.[toAssetKey(assetId)]?.[dropId]) || 0;

/**
 * Lock id for the one-time claim of a drop by a profile. It is taken on the dropped asset (whose lock
 * conflicts public-api reports as 409, unlike visitor locks) and never released: the lock doc itself is
 * the "already claimed" marker, so concurrent submissions of the same answer (two tabs, a double
 * submit) grant and count exactly once.
 */
export const buildClaimLockId = (dropId: string, profileId: string, generation: number) =>
  `claim-${dropId}-${profileId}-${generation}`;

/** Free the drop for another claim attempt after the grant failed, by moving to the next lock generation. */
export const rollBackClaimReservation = async (
  visitor: any,
  assetId: string,
  dropId: string,
  generation: number,
): Promise<void> => {
  await visitor
    .updateDataObject({ [`${claimRetriesPath(assetId)}.${dropId}`]: generation + 1 })
    .catch((error: any) =>
      // Without this write the player can't retry: the next attempt reuses the held lock and is told it's claimed.
      console.error(`Error rolling back claim reservation for drop ${dropId} (generation ${generation})`, error),
    );
};

/**
 * Claimed if the visitor's own record says so, or if they unlocked the challenge before the v1 -> v2
 * migration collapsed the per-profile map into an aggregate count.
 */
export const hasClaimedDrop = (claims: VisitorClaims, drop: Drop, profileId: string): boolean =>
  !!claims[drop.id] || !!drop.legacyUnlockedProfileIds?.includes(profileId);
