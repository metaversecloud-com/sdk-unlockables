// What a successful unlock writes to Topia: the reward grant, in-world feedback, stats, analytics and
// the visitor's claim record.
import { KEY_ASSET_ID, expect, test } from "../../fixtures";
import { accessoryDrop, badgeDrop, drop, unlockData } from "./drops";

const unlock = async (page: any, world: any, dropId: string, body: Record<string, unknown> = { password: "pirate" }) =>
  page.request.post(world.api("/unlock/attempt"), { data: { dropId, ...body } });

const analyticNames = async (world: any) => (await world.events("analytics")).map((e: any) => e.analyticName).sort();

test("emote: granted, celebrated, counted, claimed", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("d1", { stats: { attempts: 3, unlockCount: 2 } })]) });

  const response = await unlock(page, world, "d1");

  expect(await response.json()).toEqual({ success: true, dropId: "d1", alreadyOwned: false, grantedNames: ["Wave"] });
  expect(await world.events("grant-expression")).toEqual([expect.objectContaining({ expressionId: "emote-wave", visitorId: "42" })]);
  await expect.poll(() => world.events("fire-toast")).toEqual([
    expect.objectContaining({ title: "Congrats! Emote Unlocked" }),
  ]);
  await expect.poll(() => world.events("particles")).toEqual([expect.objectContaining({ particleName: "Sparkle", followPlayerId: 42 })]);
  expect((await world.assetData()).drops.d1.stats).toEqual({ attempts: 4, unlockCount: 3 });
  expect((await world.visitorData()).claims[KEY_ASSET_ID]).toEqual({ d1: expect.any(String) });
  expect(await analyticNames(world)).toEqual(["completions", "emote_granted", "unlock_attempted", "unlock_succeeded"]);
});

test("badge: granted from the ecosystem inventory", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([badgeDrop("b1", { badgeId: "badge-2", badgeName: "Lightning Round" })]) });

  const response = await unlock(page, world, "b1");

  expect(await response.json()).toMatchObject({ success: true, alreadyOwned: false, grantedNames: ["Lightning Round"] });
  expect(await world.events("grant-item")).toEqual([expect.objectContaining({ name: "Lightning Round" })]);
  await expect.poll(() => world.events("fire-toast")).toEqual([
    expect.objectContaining({ title: "Congrats! Badge Unlocked", text: "You just earned the Lightning Round badge!" }),
  ]);
  expect(await analyticNames(world)).toContain("badge_granted");
});

test("accessories: every selected accessory is granted", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([accessoryDrop("a1", { accessoryIds: ["acc-hat", "acc-patch", "acc-hook"], accessoryNames: ["Pirate Hat", "Eye Patch", "Hook"] })]) });

  const response = await unlock(page, world, "a1");

  expect(await response.json()).toMatchObject({ success: true, grantedNames: ["Pirate Hat", "Eye Patch", "Hook"] });
  expect((await world.events("grant-item")).map((e) => e.name)).toEqual(["Pirate Hat", "Eye Patch", "Hook"]);
  expect(await analyticNames(world)).toContain("accessory_granted");
});

test("a drop copied from another ecosystem grants by name and heals its ids", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      accessoryDrop("a1", { accessoryIds: ["foreign-hat", "acc-patch"], accessoryNames: ["Pirate Hat", "Eye Patch"] }),
      badgeDrop("b1", { badgeId: "foreign-badge", badgeName: "Quiz Master" }),
    ]),
  });

  expect((await (await unlock(page, world, "a1")).json()).success).toBe(true);
  expect((await (await unlock(page, world, "b1")).json()).success).toBe(true);

  expect((await world.events("grant-item")).map((e) => e.name)).toEqual(["Pirate Hat", "Eye Patch", "Quiz Master"]);
  const { drops } = await world.assetData();
  expect(drops.a1.accessoryIds).toEqual(["acc-hat", "acc-patch"]);
  expect(drops.b1).toMatchObject({ badgeId: "badge-3", badgeName: "Quiz Master" });
});

test("a reward missing from the catalog fails without claiming or counting", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([badgeDrop("b1", { badgeId: "gone", badgeName: "Gone Badge" })]) });

  const response = await unlock(page, world, "b1");

  expect(response.status()).toBe(500);
  expect(await world.events("grant-item")).toEqual([]);
  expect((await world.assetData()).drops.b1.stats).toEqual({ attempts: 0, unlockCount: 0 });
  expect((await world.visitorData()).claims?.[KEY_ASSET_ID]?.b1).toBeUndefined();
});

test("a retired (inactive) badge is never granted", async ({ page, world }) => {
  test.fail(true, "EXP-452: grants read the fresh inventory without dropping INACTIVE items");
  await world.seed({ assetData: unlockData([badgeDrop("b1", { badgeId: "badge-retired", badgeName: "Retired Badge" })]) });

  await unlock(page, world, "b1");

  expect(await world.events("grant-item")).toEqual([]);
});

test("an emote the player already owns is reported as already owned, not counted again", async ({ page, world }) => {
  test.fail(true, "EXP-452: grantExpression errors are swallowed, so the 409 already-owned check never runs");
  await world.seed({ assetData: unlockData([drop("d1")]), visitor: { expressions: ["emote-wave"] } });

  const response = await unlock(page, world, "d1");

  expect(await response.json()).toMatchObject({ success: true, alreadyOwned: true });
  await expect.poll(() => world.events("fire-toast")).toEqual([expect.objectContaining({ title: "Already Unlocked" })]);
  expect(await world.events("particles")).toEqual([]);
  expect((await world.assetData()).drops.d1.stats.unlockCount).toBe(0);
  expect(await analyticNames(world)).not.toContain("emote_granted");
});

test("a failed emote grant is not reported as an unlock", async ({ page, world }) => {
  test.fail(true, "EXP-452: grantExpression errors are swallowed and the player is told they unlocked it");
  await world.seed({ assetData: unlockData([drop("d1")]), failures: { "grant-expression": 500 } });

  const response = await unlock(page, world, "d1");

  expect(response.ok()).toBe(false);
  expect(await world.events("fire-toast")).toEqual([]);
  expect((await world.assetData()).drops.d1.stats.unlockCount).toBe(0);
  expect((await world.visitorData()).claims?.[KEY_ASSET_ID]?.d1).toBeUndefined();
});

test("the player sees an error when the reward can't be granted", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([badgeDrop("b1", { badgeId: "gone", badgeName: "Gone Badge" })]) });
  await page.goto(world.url("/"));

  await page.getByPlaceholder("Type your answer...").fill("pirate");
  await page.getByRole("button", { name: "Unlock Badge" }).click();

  await expect(page.locator(".error-toast")).toContainText("Error");
  await expect(page.getByRole("heading", { name: "Badge Unlocked!" })).toHaveCount(0);
});
