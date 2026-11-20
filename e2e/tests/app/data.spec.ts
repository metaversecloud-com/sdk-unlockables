// How the key asset's data object is set up and upgraded the first time the app opens it.
import { KEY_ASSET_ID, expect, test } from "../../fixtures";
import { badgeDrop, unlockData } from "./drops";

test("a fresh asset gets the empty v2 shape", async ({ page, world }) => {
  await world.seed({ assetData: {} });
  await page.goto(world.url("/"));
  await expect(page.getByText("No current unlock challenges available!")).toBeVisible();

  expect(await world.assetData()).toEqual({
    schemaVersion: 2,
    timezone: "America/Chicago",
    statsOwnerAssetId: KEY_ASSET_ID,
    drops: {},
  });
});

test("a v1 single-challenge asset becomes one always-available drop, keeping who unlocked it", async ({ page, world }) => {
  await world.seed({
    assetData: {
      emoteId: "emote-dance",
      emoteName: "Dance",
      emotePreviewUrl: "https://topia-e2e.s3.amazonaws.com/dance.png",
      emoteDescription: "Old question",
      password: "salsa",
      stats: { attempts: 12, successfulUnlocks: { [world.profileId]: "2025-01-01", someoneElse: "2025-01-02" } },
    },
  });
  await page.goto(world.url("/"));

  // This player unlocked it under v1, so they see it as unlocked.
  await expect(page.getByRole("heading", { name: "Emote Unlocked!" })).toBeVisible();
  const data = await world.assetData();
  const drops = Object.values(data.drops) as any[];
  expect(data).toMatchObject({ schemaVersion: 2, statsOwnerAssetId: KEY_ASSET_ID, timezone: "America/Chicago" });
  expect(drops).toEqual([
    expect.objectContaining({
      unlockType: "emote",
      itemId: "emote-dance",
      itemName: "Dance",
      itemDescription: "Old question",
      password: "salsa",
      startDate: null,
      endDate: null,
      stats: { attempts: 12, unlockCount: 2 },
      legacyUnlockedProfileIds: [world.profileId, "someoneElse"],
    }),
  ]);
});

test("an asset copied from another world keeps its drops but starts its engagement over", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData(
      [badgeDrop("b1", { stats: { attempts: 9, unlockCount: 5 }, responses: { p: {} }, legacyUnlockedProfileIds: [world.profileId] })],
      { statsOwnerAssetId: "asset-in-another-world" },
    ),
  });
  await page.goto(world.url("/"));
  await expect(page.getByRole("button", { name: "Unlock Badge" })).toBeVisible();

  expect((await world.assetData()).drops.b1).toMatchObject({
    badgeId: "badge-1",
    password: "pirate",
    stats: { attempts: 0, unlockCount: 0 },
    responses: {},
    legacyUnlockedProfileIds: [],
  });
  expect((await world.assetData()).statsOwnerAssetId).toBe(KEY_ASSET_ID);
});

test("a v2 asset without a timezone gets the default", async ({ page, world }) => {
  const data: Record<string, any> = unlockData([badgeDrop("b1")]);
  delete data.timezone;
  await world.seed({ assetData: data });
  await page.goto(world.url("/"));
  await expect(page.getByRole("button", { name: "Unlock Badge" })).toBeVisible();

  expect((await world.assetData()).timezone).toBe("America/Chicago");
});
