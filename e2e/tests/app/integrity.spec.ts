// Unlock rules the server must enforce on its own (a player can post anything to /unlock/attempt),
// and counters that must survive concurrent players.
import { KEY_ASSET_ID, expect, test } from "../../fixtures";
import { badgeDrop, claimed, day, drop, unlockData } from "./drops";

const attempt = (page: any, path: string, data: Record<string, unknown>) => page.request.post(path, { data });

test("drops outside their window can't be claimed by posting their id", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      drop("future", { startDate: day(1), endDate: day(3) }),
      drop("past", { startDate: day(-5), endDate: day(-1) }),
    ]),
  });

  for (const dropId of ["future", "past"]) {
    const response = await attempt(page, world.api("/unlock/attempt"), { dropId, password: "pirate" });
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("This challenge isn't available right now.");
  }
  expect(await world.events("grant-expression")).toEqual([]);
});

test("a drop's window is inclusive of its end date", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("last-day", { startDate: day(-3), endDate: day(0) })]) });

  const response = await attempt(page, world.api("/unlock/attempt"), { dropId: "last-day", password: "pirate" });

  expect((await response.json()).success).toBe(true);
});

test("drop windows follow the asset's configured timezone", async ({ page, world }) => {
  // UTC+14: for most of the day its date is ahead of the default America/Chicago.
  const tz = "Pacific/Kiritimati";
  await world.seed({ assetData: unlockData([drop("tz", { startDate: day(0, tz), endDate: day(0, tz) })], { timezone: tz }) });

  const response = await attempt(page, world.api("/unlock/attempt"), { dropId: "tz", password: "pirate" });

  expect((await response.json()).success).toBe(true);
  const state = await (await page.request.get(world.api("/game-state"))).json();
  expect(state).toMatchObject({ timezone: tz, today: day(0, tz) });
});

test("an unconfigured drop can't be claimed", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("half", { itemId: undefined })]) });

  const response = await attempt(page, world.api("/unlock/attempt"), { dropId: "half", password: "pirate" });

  expect(response.status()).toBe(400);
  expect((await response.json()).message).toBe("This challenge isn't ready yet.");
});

test("unknown drops and missing ids are rejected", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("d1")]) });

  expect((await attempt(page, world.api("/unlock/attempt"), { password: "pirate" })).status()).toBe(400);
  expect((await attempt(page, world.api("/unlock/attempt"), { dropId: "nope", password: "pirate" })).status()).toBe(404);
});

test("replaying a successful unlock doesn't grant or count it again", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([badgeDrop("b1")]) });

  await attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" });
  const replay = await attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" });

  expect(await replay.json()).toMatchObject({ success: true, alreadyClaimed: true });
  expect(await world.events("grant-item")).toHaveLength(1);
  expect((await world.assetData()).drops.b1.stats).toEqual({ attempts: 1, unlockCount: 1 });
});

test("players who unlocked before the v2 migration count as having claimed", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([badgeDrop("b1", { legacyUnlockedProfileIds: [world.profileId] })]) });

  const response = await attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" });

  expect(await response.json()).toMatchObject({ alreadyClaimed: true });
  expect(await world.events("grant-item")).toEqual([]);
});

test("a claim on another asset doesn't count for this one", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([badgeDrop("b1")]),
    visitorData: { claims: { "another-asset": { b1: "2026-01-01" } } },
  });

  const response = await attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" });

  expect(await response.json()).toMatchObject({ success: true, alreadyOwned: false });
});

test("answers of the wrong type are judged wrong, never right", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      badgeDrop("mc", { questionType: "multiple_choice", password: undefined, options: ["A", "B"], correctAnswers: [1] }),
      badgeDrop("ata", { questionType: "all_that_apply", password: undefined, options: ["A", "B", "C"], correctAnswers: [0, 2] }),
    ]),
  });
  const tries: [string, unknown][] = [
    ["mc", ["1"]],
    ["mc", [1, 1]],
    ["mc", "1"],
    ["ata", [0, 2, 2]],
    ["ata", ["0", "2"]],
    ["ata", []],
  ];

  for (const [dropId, selectedAnswers] of tries) {
    const response = await attempt(page, world.api("/unlock/attempt"), { dropId, selectedAnswers });
    expect(response.status(), JSON.stringify(selectedAnswers)).toBe(400);
  }
  expect(await world.events("grant-item")).toEqual([]);
});

test("the stored open response uses the session's identity, not body fields", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("open", { questionType: "open_text", password: undefined })]) });

  await attempt(page, world.api("/unlock/attempt"), { dropId: "open", password: "hi", profileId: "victim", displayName: "Admin" });

  expect(Object.keys((await world.assetData()).drops.open.responses)).toEqual([world.profileId]);
  expect((await world.assetData()).drops.open.responses[world.profileId].displayName).toBe(world.displayName);
});

test.describe("concurrent players", () => {
  // Writes to the key asset land 300ms after they're sent, so both requests read the drop first.
  const slowAssetWrites = { "/assets/key-asset/update-data-object": 300 };

  test("two wrong answers at once count as two attempts", async ({ page, world }) => {
    test.fail(true, "EXP-452: attempts is a read-modify-write without a lock or increment");
    await world.seed({ assetData: unlockData([drop("d1")]), otherVisitors: { 43: {} }, delays: slowAssetWrites });

    await Promise.all([
      attempt(page, world.api("/unlock/attempt"), { dropId: "d1", password: "wrong" }),
      attempt(page, world.apiAs(43, "/unlock/attempt"), { dropId: "d1", password: "nope" }),
    ]);

    expect((await world.assetData()).drops.d1.stats.attempts).toBe(2);
  });

  test("two players unlocking at once both count", async ({ page, world }) => {
    test.fail(true, "EXP-452: unlockCount is read before the lock is taken, so one unlock is lost");
    await world.seed({ assetData: unlockData([badgeDrop("b1")]), otherVisitors: { 43: {} }, delays: slowAssetWrites });

    const responses = await Promise.all([
      attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" }),
      attempt(page, world.apiAs(43, "/unlock/attempt"), { dropId: "b1", password: "pirate" }),
    ]);

    for (const response of responses) expect((await response.json()).success).toBe(true);
    expect(await world.events("grant-item")).toHaveLength(2);
    expect((await world.assetData()).drops.b1.stats).toEqual({ attempts: 2, unlockCount: 2 });
  });

  test("the same answer sent twice at once grants and counts once", async ({ page, world }) => {
    test.fail(true, "EXP-452: the claim is checked before the grant and recorded after it, with nothing in between");
    await world.seed({ assetData: unlockData([badgeDrop("b1")]), delays: slowAssetWrites });

    await Promise.all([
      attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" }),
      attempt(page, world.api("/unlock/attempt"), { dropId: "b1", password: "pirate" }),
    ]);

    expect(await world.events("grant-item")).toHaveLength(1);
    expect((await world.assetData()).drops.b1.stats.unlockCount).toBe(1);
  });

  test("each player's claim is their own", async ({ page, world }) => {
    await world.seed({ assetData: unlockData([badgeDrop("b1")]), otherVisitors: { 43: {} }, visitorData: claimed("b1") });

    const response = await attempt(page, world.apiAs(43, "/unlock/attempt"), { dropId: "b1", password: "pirate" });

    expect(await response.json()).toMatchObject({ success: true, alreadyOwned: false });
    expect((await world.visitorData(43)).claims[KEY_ASSET_ID]).toEqual({ b1: expect.any(String) });
  });
});
