import { Request, Response } from "express";
import {
  DEFAULT_TIMEZONE,
  errorHandler,
  evaluateAnswer,
  getCredentials,
  getDroppedAsset,
  getDropState,
  getVisitor,
  getVisitorClaims,
  grantDropReward,
  hasClaimedDrop,
  isDropClaimable,
  isDropConfigured,
  recordVisitorClaim,
  todayInTimezone,
} from "../utils/index.js";

export const handleUnlockAttempt = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, displayName, profileId, urlSlug } = credentials;
    const { dropId, password, selectedAnswers } = req.body;

    if (!dropId) return res.status(400).json({ success: false, message: "Missing dropId" });

    const droppedAsset = await getDroppedAsset(credentials);
    const dataObject = droppedAsset.dataObject;
    const drop = dataObject.drops?.[dropId];

    if (!drop) return res.status(404).json({ success: false, message: "That challenge no longer exists." });
    if (!isDropConfigured(drop)) {
      return res.status(400).json({ success: false, message: "This challenge isn't ready yet." });
    }

    // The window is re-checked here, not just in the feed: a client could post the id of an upcoming
    // or ended drop to claim it outside its window.
    const today = todayInTimezone(dataObject.timezone || DEFAULT_TIMEZONE);
    const state = getDropState(drop, today);
    if (!isDropClaimable(state)) {
      return res.status(400).json({ success: false, message: "This challenge isn't available right now." });
    }

    const visitor = await getVisitor(credentials);
    const claims = await getVisitorClaims(visitor, assetId);

    // Already claimed: never grant or count twice. Without this the aggregate unlockCount could be
    // inflated by replaying the request, since it no longer dedupes by profile id structurally.
    if (hasClaimedDrop(claims, drop, profileId)) {
      return res.json({ success: true, alreadyClaimed: true, dropId, message: "You've already unlocked this." });
    }

    const isCorrect = evaluateAnswer({ drop, password, selectedAnswers });
    const attemptsUpdate = { [`drops.${dropId}.stats.attempts`]: (drop.stats?.attempts || 0) + 1 };

    if (!isCorrect) {
      await droppedAsset.updateDataObject(attemptsUpdate, {
        analytics: [
          { analyticName: "unlock_attempted", profileId, uniqueKey: profileId, urlSlug },
          { analyticName: "false_responses", profileId, uniqueKey: profileId, urlSlug },
        ],
      });

      return res.status(400).json({ success: false, message: "Oops! That's not right. Try again!" });
    }

    const { alreadyOwned, grantedNames } = await grantDropReward({ credentials, visitor, drop });

    const dataUpdate: Record<string, any> = { ...attemptsUpdate };

    if (drop.questionType === "open_text" && password) {
      dataUpdate[`drops.${dropId}.responses.${profileId}`] = {
        displayName,
        response: password.trim(),
        respondedAt: new Date().toISOString(),
      };
    }

    const analytics = [
      { analyticName: "unlock_attempted", profileId, uniqueKey: profileId, urlSlug },
      { analyticName: "completions", profileId, uniqueKey: profileId, urlSlug },
      { analyticName: "unlock_succeeded", profileId, uniqueKey: profileId, urlSlug },
    ];

    if (!alreadyOwned) {
      analytics.push({
        analyticName: `${drop.unlockType}_granted`,
        profileId,
        uniqueKey: profileId,
        urlSlug,
      });
      dataUpdate[`drops.${dropId}.stats.unlockCount`] = (drop.stats?.unlockCount || 0) + 1;
    }

    // unlockCount is a denormalised counter, so the success write takes the lock. Concurrent unlocks
    // could otherwise read the same value and lose an increment; the visitor claim records remain the
    // authoritative record of who unlocked what.
    const lockId = `${assetId}-${dropId}-${Math.round(Date.now() / 1000)}`;
    await droppedAsset.updateDataObject(dataUpdate, { analytics, lock: { lockId, releaseLock: true } });

    // Recorded even when already owned, so the challenge stops reappearing for this visitor.
    await recordVisitorClaim(visitor, assetId, dropId);

    return res.json({ success: true, dropId, alreadyOwned, grantedNames });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleUnlockAttempt",
      message: "Error attempting to unlock item",
      req,
      res,
    });
  }
};
