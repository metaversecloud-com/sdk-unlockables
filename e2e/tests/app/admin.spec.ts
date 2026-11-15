// The admin side: scheduling drops in the editor, and the admin-only routes behind it.
import { expect, test } from "../../fixtures";
import { MOCK_TOPIA_PORT, MOCK_TOPIA_URL } from "../../constants";
import { accessoryDrop, badgeDrop, day, drop, unlockData } from "./drops";

const openAdmin = async (page: any, world: any) => {
  await page.goto(world.url("/"));
  await page.getByTitle("Settings").click();
  await expect(page.getByRole("heading", { name: "Scheduled Drops" })).toBeVisible();
};

test("only admins get the settings gear", async ({ page, world }) => {
  await world.seed({ isAdmin: false });
  await page.goto(world.url("/"));
  await expect(page.getByText("No current unlock challenges available!")).toBeVisible();
  await expect(page.getByTitle("Settings")).toHaveCount(0);

  await world.seed({ isAdmin: true });
  await page.reload();
  await expect(page.getByTitle("Settings")).toBeVisible();
});

test("the drops list shows each drop's state, unlock count and visibility", async ({ page, world }) => {
  await world.seed({
    isAdmin: true,
    assetData: unlockData([
      drop("live", { challengeName: "Live One", startDate: day(-1), endDate: day(2), stats: { attempts: 5, unlockCount: 3 } }),
      drop("future", { challengeName: "Future One", startDate: day(3), showInUpcoming: true, upcomingDisplay: "mystery" }),
      drop("done", { challengeName: "Done One", startDate: day(-9), endDate: day(-2), stats: { attempts: 1, unlockCount: 1 } }),
      drop("always", { challengeName: "Always One" }),
      drop("draft", { challengeName: "Draft One", itemId: undefined }),
    ]),
  });
  await openAdmin(page, world);

  const row = (name: string) => page.getByRole("button", { name: new RegExp(name) });
  await expect(page.getByText("Timezone: America/Chicago")).toBeVisible();
  await expect(row("Live One")).toContainText("Live · 3");
  await expect(row("Future One")).toContainText("Upcoming");
  await expect(row("Future One")).toContainText("❓");
  await expect(row("Done One")).toContainText("Ended · 1");
  await expect(row("Always One")).toContainText("Always on · 0");
  await expect(row("Draft One")).toContainText("Incomplete — not shown to users");
  // Always-available drops are pinned first.
  await expect(page.locator(".drop-row").first()).toContainText("Always One");
});

test("creating a badge drop in the editor saves it to the key asset", async ({ page, world }) => {
  await world.seed({ isAdmin: true });
  await openAdmin(page, world);
  await expect(page.getByText("No drops yet")).toBeVisible();

  await page.getByRole("button", { name: "+ Add drop" }).click();
  await page.locator("select").filter({ hasText: "Avatar Accessory" }).selectOption("badge");
  await page.locator("select").filter({ hasText: "Select a badge" }).selectOption({ label: "Quiz Master" });
  await expect(page.getByText("Defaults to “Quiz Master”.")).toBeVisible();
  await page.locator("textarea").fill("What is the capital of France?");
  await page.getByPlaceholder("Correct answer").fill(" Paris ");
  await page.locator('input[type="date"]').first().fill(day(-1));
  await page.locator('input[type="date"]').last().fill(day(5));
  await page.getByRole("button", { name: "Save Configuration" }).click();

  await expect(page.getByRole("button", { name: /Quiz Master/ })).toContainText("Live · 0");
  const drops = Object.values((await world.assetData()).drops) as any[];
  expect(drops).toEqual([
    expect.objectContaining({
      unlockType: "badge",
      badgeId: "badge-3",
      badgeName: "Quiz Master",
      challengeName: "Quiz Master",
      itemDescription: "What is the capital of France?",
      questionType: "text",
      password: "paris",
      startDate: day(-1),
      endDate: day(5),
      showInUpcoming: true,
      stats: { attempts: 0, unlockCount: 0 },
    }),
  ]);
  expect(await world.events("analytics")).toContainEqual(expect.objectContaining({ analyticName: "drop_config_changed" }));
});

test("the editor shows validation errors inline and saves nothing", async ({ page, world }) => {
  await world.seed({ isAdmin: true });
  await openAdmin(page, world);
  await page.getByRole("button", { name: "+ Add drop" }).click();

  await page.getByRole("button", { name: "Save Configuration" }).click();
  await expect(page.locator(".error-toast")).toHaveText("Please select an emote.");

  await page.locator("select").filter({ hasText: "Select an emote" }).selectOption({ label: "Dance" });
  await page.getByRole("button", { name: "Save Configuration" }).click();
  await expect(page.locator(".error-toast")).toHaveText("Please enter a question or description.");

  expect((await world.assetData()).drops).toEqual({});
});

test("the server rejects invalid drops the editor would never send", async ({ page, world }) => {
  await world.seed({ isAdmin: true });
  const save = (data: Record<string, unknown>) => page.request.post(world.api("/drops"), { data });
  const base = { unlockType: "badge", badgeId: "badge-1", badgeName: "Perfect Score", itemDescription: "Q?", questionType: "text", password: "a" };

  const cases: [Record<string, unknown>, string][] = [
    [{ ...base, questionType: "riddle" }, "Please choose a question type."],
    [{ ...base, questionType: "multiple_choice", options: ["a", "b"], correctAnswers: [0, 1] }, "Please add at least two options and mark exactly one as correct."],
    [{ ...base, questionType: "all_that_apply", options: ["a", "b"], correctAnswers: [5] }, "A correct answer points at an option that doesn't exist."],
    [{ ...base, startDate: "next week" }, "Start date must be a valid date."],
    [{ ...base, startDate: "2026-05-02", endDate: "2026-05-01" }, "End date must be on or after the start date."],
  ];
  for (const [data, message] of cases) {
    const response = await save(data);
    expect(response.status(), message).toBe(400);
    expect((await response.json()).message).toBe(message);
  }
  expect((await world.assetData()).drops).toEqual({});
});

test("editing a drop changes its configuration but keeps its engagement", async ({ page, world }) => {
  await world.seed({
    isAdmin: true,
    assetData: unlockData([
      drop("d1", { challengeName: "Old Name", stats: { attempts: 7, unlockCount: 2 }, responses: { p: { displayName: "A", response: "x", respondedAt: "2026-01-01" } } }),
    ]),
  });
  await openAdmin(page, world);

  await page.getByRole("button", { name: /Old Name/ }).click();
  await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("Question for d1");
  await expect(page.getByPlaceholder("Correct answer")).toHaveValue("pirate");
  await expect(page.locator(".stat-card").first()).toContainText("7");

  await page.getByPlaceholder("Wave").fill("New Name");
  await page.locator("select").filter({ hasText: "Text Answer" }).selectOption("multiple_choice");
  await page.getByPlaceholder("Option 1").fill("Yes");
  await page.getByPlaceholder("Option 2").fill("No");
  await page.getByTitle("Mark as correct").nth(1).click();
  await page.getByRole("button", { name: "Save Configuration" }).click();
  await expect(page.getByRole("button", { name: /New Name/ })).toBeVisible();

  const saved = (await world.assetData()).drops.d1;
  expect(saved).toMatchObject({
    challengeName: "New Name",
    questionType: "multiple_choice",
    options: ["Yes", "No"],
    correctAnswers: [1],
    stats: { attempts: 7, unlockCount: 2 },
    responses: { p: expect.any(Object) },
  });
  // The old text answer doesn't linger behind the new question type.
  expect(saved.password).toBeUndefined();
});

test("duplicating a drop copies its configuration without dates or engagement", async ({ page, world }) => {
  await world.seed({
    isAdmin: true,
    assetData: unlockData([badgeDrop("d1", { challengeName: "Original", startDate: day(-1), endDate: day(1), stats: { attempts: 4, unlockCount: 4 } })]),
  });
  await openAdmin(page, world);
  await page.getByRole("button", { name: /Original/ }).click();

  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator(".drop-row")).toHaveCount(2);

  const drops = Object.values((await world.assetData()).drops) as any[];
  const copy = drops.find((d) => d.id !== "d1");
  expect(copy).toMatchObject({
    challengeName: "Original",
    badgeId: "badge-1",
    password: "pirate",
    startDate: null,
    endDate: null,
    stats: { attempts: 0, unlockCount: 0 },
    responses: {},
  });
  expect(copy.id).toMatch(/^drop-/);
});

test("deleting a drop asks first, then removes it", async ({ page, world }) => {
  await world.seed({ isAdmin: true, assetData: unlockData([drop("keep", { challengeName: "Keeper" }), drop("gone", { challengeName: "Goner" })]) });
  await openAdmin(page, world);
  await page.getByRole("button", { name: /Goner/ }).click();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete this drop?");
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(Object.keys((await world.assetData()).drops).sort()).toEqual(["gone", "keep"]);

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".drop-row")).toHaveCount(1);
  expect(Object.keys((await world.assetData()).drops)).toEqual(["keep"]);
});

test("the engagement panel lists open responses, newest first", async ({ page, world }) => {
  await world.seed({
    isAdmin: true,
    assetData: unlockData([
      drop("open", {
        challengeName: "Thoughts",
        questionType: "open_text",
        password: undefined,
        stats: { attempts: 2, unlockCount: 2 },
        responses: {
          a: { displayName: "Ann", response: "First!", respondedAt: "2026-01-01T00:00:00.000Z" },
          b: { displayName: "Bob", response: "Second", respondedAt: "2026-02-01T00:00:00.000Z" },
        },
      }),
    ]),
  });
  await openAdmin(page, world);
  await page.getByRole("button", { name: /Thoughts/ }).click();

  await expect(page.getByRole("heading", { name: "Responses (2)" })).toBeVisible();
  await expect(page.locator(".response-row").first()).toContainText("BobSecond");
  await expect(page.locator(".response-row").last()).toContainText("AnnFirst!");
});

test("the preview shows the card without submitting answers", async ({ page, world }) => {
  await world.seed({ isAdmin: true, assetData: unlockData([drop("d1", { challengeName: "Previewed" })]) });
  await openAdmin(page, world);
  await page.getByRole("button", { name: /Previewed/ }).click();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Preview only — answers aren't submitted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock Emote" })).toBeDisabled();
});

test("the editor offers unlockable emotes, accessory packs and active badges", async ({ page, world }) => {
  await world.seed({ isAdmin: true });

  const response = await page.request.get(world.api("/unlockables"));
  const body = await response.json();

  expect(body.emotes.map((e: any) => e.name)).toEqual(["Wave", "Dance"]);
  expect(body.packs).toEqual([
    expect.objectContaining({
      id: "pack-pirate",
      name: "Pirate Pack",
      accessories: [
        expect.objectContaining({ id: "acc-hat", name: "Pirate Hat", category: "hat" }),
        expect.objectContaining({ id: "acc-patch", name: "Eye Patch", category: "face" }),
        expect.objectContaining({ id: "acc-hook", name: "Hook", category: "hand" }),
      ],
    }),
  ]);
  expect(body.badges.map((b: any) => b.name)).not.toContain("Retired Badge");
  expect(body.badges.map((b: any) => b.name)).toEqual(expect.arrayContaining(["Perfect Score", "Quiz Master"]));
});

test("an accessory drop stores the chosen accessories with their names", async ({ page, world }) => {
  await world.seed({ isAdmin: true });
  await openAdmin(page, world);
  await page.getByRole("button", { name: "+ Add drop" }).click();

  await page.locator("select").filter({ hasText: "Avatar Accessory" }).selectOption("accessory");
  await page.locator("select").filter({ hasText: "Select a pack" }).selectOption("pack-pirate");
  await page.getByText("Eye Patch").click();
  await page.getByText("Hook", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Accessories (2/3)" })).toBeVisible();
  await page.locator("textarea").fill("Arr?");
  await page.getByPlaceholder("Correct answer").fill("arr");
  await page.getByRole("button", { name: "Save Configuration" }).click();
  await expect(page.locator(".drop-row")).toHaveCount(1);

  const [saved] = Object.values((await world.assetData()).drops) as any[];
  expect(saved).toMatchObject({
    unlockType: "accessory",
    packId: "pack-pirate",
    accessoryIds: ["acc-patch", "acc-hook"],
    accessoryNames: ["Eye Patch", "Hook"],
    itemName: "Pirate Pack",
    challengeName: "Pirate Pack",
  });
});

test("an emote preview from outside S3 is mirrored into the app's bucket", async ({ page, world }) => {
  await world.seed({ isAdmin: true });
  // Where the app (local Node or the Docker image) reaches the mock.
  const mockFromApp = process.env.E2E_APP_IMAGE ? `http://host.docker.internal:${MOCK_TOPIA_PORT}` : MOCK_TOPIA_URL;
  const name = `Jump-${world.urlSlug}`;

  const response = await page.request.post(world.api("/drops"), {
    data: { unlockType: "emote", itemId: "emote-dance", itemName: name, itemPreviewUrl: `${mockFromApp}/images/jump.png`, itemDescription: "Q?", password: "a" },
  });

  expect(response.ok()).toBe(true);
  const [saved] = Object.values((await world.assetData()).drops) as any[];
  expect(saved.itemPreviewUrl).toBe(`https://e2e_bucket.s3.us-east-1.amazonaws.com/${name}.png`);
  const s3 = await (await page.request.get(`${MOCK_TOPIA_URL}/__mock/s3`)).json();
  expect(s3.objects[`${name}.png`]).toMatchObject({ bucket: "e2e_bucket", contentType: "image/png" });
});

test("opening the admin list prunes drops that ended over 90 days ago", async ({ page, world }) => {
  await world.seed({
    isAdmin: true,
    assetData: unlockData([
      drop("ancient", { challengeName: "Ancient", startDate: day(-200), endDate: day(-91) }),
      drop("recent", { challengeName: "Recent", startDate: day(-100), endDate: day(-89) }),
    ]),
  });
  await openAdmin(page, world);

  await expect(page.getByRole("button", { name: /Recent/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ancient/ })).toHaveCount(0);
  expect(Object.keys((await world.assetData()).drops)).toEqual(["recent"]);
});

test.describe("admin routes refuse non-admins", () => {
  const routes: [string, string, Record<string, unknown>?][] = [
    ["get", "/drops"],
    ["get", "/unlockables"],
    ["post", "/drops", { unlockType: "badge", badgeId: "badge-1", itemDescription: "Q", password: "a" }],
    ["put", "/drops/d1", { unlockType: "badge", badgeId: "badge-1", itemDescription: "Hacked", password: "a" }],
    ["delete", "/drops/d1"],
    ["post", "/drops/d1/duplicate"],
  ];
  for (const [method, path, data] of routes) {
    test(`${method.toUpperCase()} ${path}`, async ({ page, world }) => {
      const assetData = unlockData([accessoryDrop("d1")]);
      await world.seed({ isAdmin: false, assetData });

      const response = await (page.request as any)[method](world.api(path), { data });

      expect(response.status()).toBe(403);
      expect(JSON.stringify(await response.json())).not.toContain("pirate");
      expect((await world.assetData()).drops).toEqual(assetData.drops);
    });
  }
});

test("the admin drops list carries the answers; the player feed never does", async ({ page, world }) => {
  const assetData = unlockData([
    drop("text", { password: "s3cret-word" }),
    badgeDrop("mc", { questionType: "multiple_choice", password: undefined, options: ["A", "B"], correctAnswers: [1] }),
  ]);
  await world.seed({ isAdmin: true, assetData });

  const admin = await (await page.request.get(world.api("/drops"))).json();
  expect(admin.drops.find((d: any) => d.id === "text").password).toBe("s3cret-word");
  expect(admin.drops.find((d: any) => d.id === "mc").correctAnswers).toEqual([1]);

  const feed = JSON.stringify(await (await page.request.get(world.api("/game-state"))).json());
  expect(feed).not.toContain("s3cret-word");
  expect(feed).not.toContain("correctAnswers");
});
