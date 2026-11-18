// What a player sees in the drawer and how answering a challenge works.
import { VISITOR_ID, expect, test } from "../../fixtures";
import { accessoryDrop, badgeDrop, claimed, day, drop, unlockData } from "./drops";

test("shows the empty state when there is no live challenge", async ({ page, world }) => {
  await world.seed();
  await page.goto(world.url("/"));

  await expect(page.getByRole("heading", { name: "Unlock Challenges", exact: true })).toBeVisible();
  await expect(page.getByText("No current unlock challenges available!")).toBeVisible();
});

test("opened outside a Topia world, the app doesn't stay on the loading screen", async ({ page }) => {
  test.fail(true, "EXP-452: without credentials the page spins on Loading forever");
  await page.goto("/");
  await expect(page.getByText("Loading...")).toBeVisible();

  // Anything but an endless spinner: an explanation, an error, the empty app.
  await expect(page.getByText("Loading...")).toBeHidden({ timeout: 4000 });
});

test("a live challenge shows its name, question, reward and unlock count", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([drop("d1", { itemDescription: "Who sails the seas?", endDate: day(3), startDate: day(-1), stats: { attempts: 9, unlockCount: 4 } })]),
  });
  await page.goto(world.url("/"));

  await expect(page.getByRole("heading", { name: "Emote Unlock Challenge" })).toBeVisible();
  await expect(page.getByText("Who sails the seas?")).toBeVisible();
  await expect(page.getByText("4 users unlocked")).toBeVisible();
  await expect(page.getByText(/^Ends /)).toBeVisible();
  await expect(page.getByRole("img", { name: "Wave" })).toBeVisible();
});

test("drops outside their window, unconfigured drops and untagged upcoming drops are not playable", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      drop("ended", { startDate: day(-10), endDate: day(-1), challengeName: "Ended One" }),
      drop("hidden-upcoming", { startDate: day(2), endDate: day(5), challengeName: "Secret Future" }),
      drop("half", { password: "" }),
    ]),
  });
  await page.goto(world.url("/"));

  await expect(page.getByText("No current unlock challenges available!")).toBeVisible();
  await expect(page.getByText("Secret Future")).toHaveCount(0);
});

test("the upcoming strip shows tagged drops, as a mystery when asked to", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      drop("teased", { startDate: day(2), endDate: day(4), showInUpcoming: true, challengeName: "Treasure Week" }),
      badgeDrop("mystery", { startDate: day(3), endDate: day(6), showInUpcoming: true, upcomingDisplay: "mystery", challengeName: "Golden Secret" }),
    ]),
  });
  await page.goto(world.url("/"));

  await expect(page.getByText("Upcoming")).toBeVisible();
  await expect(page.getByText("Treasure Week")).toBeVisible();
  await expect(page.getByText("Mystery badge")).toBeVisible();
  await expect(page.getByText("Golden Secret")).toHaveCount(0);

  // The feed itself withholds everything but the type and dates of a mystery drop.
  const { upcoming } = await (await page.request.get(world.api("/game-state"))).json();
  expect(upcoming.find((d: any) => d.id === "mystery")).toEqual({
    id: "mystery",
    state: "upcoming",
    unlockType: "badge",
    mystery: true,
    startDate: day(3),
    endDate: day(6),
  });
});

test("recent drops show what the player unlocked and what they missed", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      drop("won", { startDate: day(-9), endDate: day(-2), itemName: "Won Emote" }),
      drop("missed", { startDate: day(-9), endDate: day(-1), itemName: "Missed Emote" }),
    ]),
    visitorData: claimed("won"),
  });
  await page.goto(world.url("/"));

  await expect(page.getByRole("heading", { name: "Recent Drops" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Won Emote" })).not.toHaveClass(/grayscale/);
  await expect(page.getByRole("img", { name: "Missed Emote" })).toHaveClass(/grayscale/);
});

test("a wrong answer keeps the card and counts the attempt", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("d1")]) });
  await page.goto(world.url("/"));

  await page.getByPlaceholder("Type your answer...").fill("ninja");
  await page.getByRole("button", { name: "Unlock Emote" }).click();

  await expect(page.getByText(/Not quite|So close|that's not it|Almost|Nope|Keep trying/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock Emote" })).toBeVisible();
  expect((await world.assetData()).drops.d1.stats).toEqual({ attempts: 1, unlockCount: 0 });
  expect(await world.events("grant-expression")).toEqual([]);
});

test("the right text answer (any case, extra spaces) unlocks the emote", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("d1")]) });
  await page.goto(world.url("/"));

  await page.getByPlaceholder("Type your answer...").fill("  PiRaTe ");
  await page.getByPlaceholder("Type your answer...").press("Enter");

  await expect(page.getByRole("heading", { name: "Emote Unlocked!" })).toBeVisible();
  await expect(page.getByText("You've unlocked the Wave emote.")).toBeVisible();
  expect(await world.events("grant-expression")).toEqual([expect.objectContaining({ expressionId: "emote-wave" })]);
});

test("an empty answer is caught before reaching the server", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("d1")]) });
  await page.goto(world.url("/"));

  await page.getByRole("button", { name: "Unlock Emote" }).click();

  await expect(page.getByText("Please enter a response")).toBeVisible();
  expect((await world.assetData()).drops.d1.stats.attempts).toBe(0);
});

test("multiple choice: only the correct option unlocks", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      badgeDrop("mc", { questionType: "multiple_choice", password: undefined, options: ["Red", "Blue", "Green"], correctAnswers: [1] }),
    ]),
  });
  await page.goto(world.url("/"));

  await page.getByText("Red").click();
  await page.getByRole("button", { name: "Unlock Badge" }).click();
  await expect(page.getByText(/Not quite|So close|that's not it|Almost|Nope|Keep trying/)).toBeVisible();

  await page.getByText("Blue").click();
  await page.getByRole("button", { name: "Unlock Badge" }).click();
  await expect(page.getByRole("heading", { name: "Badge Unlocked!" })).toBeVisible();
  await expect(page.getByText("You've earned the Perfect Score badge!")).toBeVisible();
});

test("all that apply: needs exactly the correct set", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      badgeDrop("ata", { questionType: "all_that_apply", password: undefined, options: ["Cat", "Rock", "Dog"], correctAnswers: [0, 2] }),
    ]),
  });
  await page.goto(world.url("/"));
  await expect(page.getByText("Select all that apply")).toBeVisible();

  await page.getByText("Cat").click();
  await page.getByRole("button", { name: "Unlock Badge" }).click();
  await expect(page.getByText(/Not quite|So close|that's not it|Almost|Nope|Keep trying/)).toBeVisible();

  await page.getByText("Dog").click();
  await page.getByText("Rock").click();
  await page.getByRole("button", { name: "Unlock Badge" }).click();
  await expect(page.getByText(/Not quite|So close|that's not it|Almost|Nope|Keep trying/)).toBeVisible();

  await page.getByText("Rock").click();
  await page.getByRole("button", { name: "Unlock Badge" }).click();
  await expect(page.getByRole("heading", { name: "Badge Unlocked!" })).toBeVisible();
  expect((await world.assetData()).drops.ata.stats).toEqual({ attempts: 3, unlockCount: 1 });
});

test("open response: any answer unlocks and the response is stored for the admin", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("open", { questionType: "open_text", password: undefined })]) });
  await page.goto(world.url("/"));

  await page.getByPlaceholder("Type your response...").fill("  I love treasure  ");
  await page.getByRole("button", { name: "Unlock Emote" }).click();

  await expect(page.getByRole("heading", { name: "Emote Unlocked!" })).toBeVisible();
  expect((await world.assetData()).drops.open.responses).toEqual({
    [world.profileId]: { displayName: world.displayName, response: "I love treasure", respondedAt: expect.any(String) },
  });
});

test("accessory challenge shows each accessory and unlocks them all", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([accessoryDrop("acc")]) });
  await page.goto(world.url("/"));

  await expect(page.getByRole("heading", { name: "Accessory Unlock Challenge" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Pirate Hat" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Eye Patch" })).toBeVisible();

  await page.getByPlaceholder("Type your answer...").fill("pirate");
  await page.getByRole("button", { name: "Unlock Accessory" }).click();

  await expect(page.getByRole("heading", { name: "Accessories Unlocked!" })).toBeVisible();
  await expect(page.getByText("You've unlocked 2 new accessories!")).toBeVisible();
});

test("a claimed challenge shows as unlocked when the drawer is reopened", async ({ page, world }) => {
  await world.seed({ assetData: unlockData([drop("d1")]), visitorData: claimed("d1") });
  await page.goto(world.url("/"));

  await expect(page.getByRole("heading", { name: "Emote Unlocked!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock Emote" })).toHaveCount(0);
});

test("opening the app records the open, upcoming and recent-drop analytics", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([
      drop("up", { startDate: day(2), showInUpcoming: true }),
      drop("past", { startDate: day(-5), endDate: day(-1) }),
    ]),
  });
  await page.goto(world.url("/"));
  await expect(page.getByText("Upcoming")).toBeVisible();

  await expect
    .poll(async () => (await world.events("analytics")).map((e) => e.analyticName).sort())
    .toEqual(["next_unlock_viewed", "recent_drops_viewed", "starts", "unlock_app_opened"]);
  for (const event of await world.events("analytics")) {
    expect(event).toMatchObject({ profileId: world.profileId, uniqueKey: world.profileId, urlSlug: world.urlSlug });
  }
});

test("the visitor's data object only gains this asset's claims", async ({ page, world }) => {
  await world.seed({
    assetData: unlockData([drop("d1")]),
    visitorData: { otherApp: { score: 7 }, claims: { "other-asset": { x: "2026-01-01" } } },
  });
  await page.goto(world.url("/"));
  await page.getByPlaceholder("Type your answer...").fill("pirate");
  await page.getByRole("button", { name: "Unlock Emote" }).click();
  await expect(page.getByRole("heading", { name: "Emote Unlocked!" })).toBeVisible();

  await expect
    .poll(() => world.visitorData(VISITOR_ID))
    .toEqual({
      otherApp: { score: 7 },
      claims: { "other-asset": { x: "2026-01-01" }, "key-asset": { d1: expect.any(String) } },
    });
});
