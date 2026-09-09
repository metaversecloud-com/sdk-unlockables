# Changelog

All changes from the original [sdk-emote-unlock](https://github.com/metaversecloud-com/sdk-emote-unlock) repository.

---

## Overview

This fork extends the original emote-unlock Topia interactive app with two major additions:

1. **Avatar Accessory Unlock** — A new unlock type that grants avatar accessories (from inventory packs) in addition to the original emote unlock.
2. **UI Redesign ("Treasure Trove" theme)** — A complete visual overhaul with custom typography, color system, animations, and a design appropriate for K-12 students and educators.
3. **Open Text Question Type** — A new question type where any response unlocks the item, with student responses stored and viewable by admins.

---

## New Features

### Avatar Accessory Unlock

Allows admins to configure an unlock challenge that grants avatar accessories instead of (or in addition to) emotes.

**How it works:**

- Admin selects "Avatar Accessory" as the unlock type
- Admin picks an accessory pack from the ecosystem inventory, then selects individual accessories within that pack
- Students answer the challenge question to unlock the selected accessories
- Accessories are granted via `visitor.grantInventoryItem()` from the SDK

**Files changed:**

| File                                                             | What changed                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------- |
| `server/controllers/handleEmoteUnlockConfig.ts`                  | Handles both `emote` and `accessory` unlock types. Builds data object with `accessoryIds`, `accessoryNames`, `accessoryPreviewUrls` for accessory type. S3 upload logic preserved for emote previews; accessories use pack preview URL.                                    |
| `server/controllers/handleEmoteUnlockAttempt.ts`                 | Branches on `unlockType` after answer validation. Emote path uses `visitor.grantExpression()`. Accessory path creates an `Ecosystem` instance, fetches inventory items, finds matching accessories by ID, and grants them sequentially via `visitor.grantInventoryItem()`. |
| `server/controllers/handleGetEmoteUnlock.ts`                     | Returns generic field names (`itemId`, `itemName`, `unlockType`, etc.) alongside legacy fields for backwards compatibility. Redacts `correctAnswers` for non-admin users (in addition to `password`). Dynamic default icon based on unlock type.                           |
| `server/controllers/handleGetAvailableAccessories.ts`            | **New file.** Fetches ecosystem inventory items, filters for `AVATAR_ACCESSORY_PACK` and `ACCESSORY` types, groups accessories by pack, and returns structured `{ packs: [...] }` response.                                                                                |
| `server/controllers/index.ts`                                    | Added export for `handleGetAvailableAccessories`.                                                                                                                                                                                                                          |
| `server/routes.ts`                                               | Added `GET /available-accessories` route.                                                                                                                                                                                                                                  |
| `server/utils/topiaInit.ts`                                      | Added `EcosystemFactory` import and `Ecosystem` export for inventory API access.                                                                                                                                                                                           |
| `server/utils/droppedAssets/initializeDroppedAssetDataObject.ts` | Config detection now checks for `emoteId`, `itemId`, `accessoryIds`, or `unlockType` (not just `emoteId`).                                                                                                                                                                 |
| `client/src/context/types.ts`                                    | Added `accessoryIds`, `accessoryNames`, `accessoryPreviewUrls` fields to `GameStateType`. Added `unlockType` field.                                                                                                                                                        |
| `client/src/components/AdminView.tsx`                            | Unlock type selector (emote vs accessory). Accessory pack dropdown + multi-select checklist for individual accessories with select all/none.                                                                                                                               |
| `client/src/components/UnlockView.tsx`                           | Renders multiple accessory preview images when `unlockType === "accessory"`. Dynamic text labels. Backwards-compatible field extraction (`itemId                                                                                                                           |     | emoteId`, etc.). |
| `client/public/default-accessory-icon.svg`                       | **New file.** SVG treasure box icon used as fallback for accessories without preview images.                                                                                                                                                                               |
| `package.json`                                                   | Updated `@rtsdk/topia` from `^0.15.8` to `^0.19.4` (required for `EcosystemFactory` and inventory APIs).                                                                                                                                                                   |

**Data object structure (accessory type):**

```json
{
  "unlockType": "accessory",
  "accessoryIds": ["id1", "id2"],
  "accessoryNames": ["Hat", "Cape"],
  "accessoryPreviewUrls": ["/url1.png", "/url2.png"],
  "itemName": "Cool Pack",
  "itemDescription": "Answer the question to unlock!",
  "itemPreviewUrl": "/pack-preview.png",
  "questionType": "text",
  "password": "answer",
  "stats": { "attempts": 0, "successfulUnlocks": {} }
}
```

---

### Open Text Question Type

A new question type (`open_text`) where any non-empty response grants the unlock. Designed for open-ended prompts like "What's your favorite animal?" where there's no wrong answer.

**How it works:**

- Admin selects "Open Response (any answer unlocks)" from the Question Type dropdown
- No answer/options configuration is needed — admin only sets the question
- Any non-empty student response is accepted and triggers the unlock
- All student responses are stored in `stats.responses` and displayed in a table in the admin Engagement section

**Files changed:**

| File                                             | What changed                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/context/types.ts`                    | Added `"open_text"` to `QuestionType` union. Added `responses` to stats type: `{ [profileId]: { displayName, response, respondedAt } }`.                                                                                                                                                                                                                         |
| `server/controllers/handleEmoteUnlockAttempt.ts` | Added `open_text` branch: `isCorrect = !!(password && password.trim())`. Stores response text in `stats.responses.{profileId}` with displayName and timestamp.                                                                                                                                                                                                   |
| `server/controllers/handleEmoteUnlockConfig.ts`  | Added `open_text` branch that skips password/options field generation (no answer validation needed).                                                                                                                                                                                                                                                             |
| `client/src/components/AdminView.tsx`            | Added "Open Response" option to question type dropdown. Shows info banner when selected ("Users can type anything. Every response grants the unlock."). Skips answer validation on save. Config summary shows "Any response" for the Answer field. Engagement section includes a Student Responses table (sorted newest-first) when `open_text` responses exist. |
| `client/src/components/UnlockView.tsx`           | Handles `open_text` like `text` for input rendering (with different placeholder: "Type your response..."). Sends response as `password` field in the API call. Default description changes to "Share your thoughts to unlock...".                                                                                                                                |

---

### UI Redesign — "Treasure Trove" Theme

A complete visual redesign targeting K-12 students (main challenge view) and teachers/educators (admin config panel). The theme evokes a treasure hunt / achievement unlock aesthetic.

#### Design System

**Typography (Google Fonts):**

- **Righteous** — Display/heading font. Retro-cool, distinctive, fun across K-12 ages.
- **Albert Sans** — Body text font. Warm humanist sans-serif, excellent screen readability.

**Color Palette — "Sunset Adventure":**
| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#D94F30` | Burnt sienna — buttons, key actions |
| `--color-primary-hover` | `#C04328` | Darker primary for hover states |
| `--color-primary-soft` | `#FCEEE9` | Light primary tint for backgrounds |
| `--color-secondary` | `#1B4965` | Deep sea blue — headings, depth |
| `--color-accent` | `#F5CB5C` | Gold coin — achievements, highlights |
| `--color-accent-glow` | `#FFF3C4` | Soft gold for selected states |
| `--color-bg` | `#FAF7F2` | Warm parchment page background |
| `--color-surface` | `#FFFFFF` | Cards, inputs |
| `--color-text` | `#1E293B` | Primary text |
| `--color-text-soft` | `#64748B` | Muted/secondary text |
| `--color-success` | `#059669` | Unlock success |
| `--color-success-bg` | `#D1FAE5` | Success background |
| `--color-border` | `#E2DDD5` | Warm gray borders |

**Animations:**

- `fadeSlideUp` — Staggered page-load reveals (`.stagger-children` utility)
- `shake` — Card shake on wrong answer
- `confettiDrop` — CSS-only confetti celebration on successful unlock
- `starBurst` — Gold star spin-in on success
- `bounceIn` — Success card entrance
- `float` — Subtle floating background shapes
- `gentlePulse` — Item preview breathing effect
- `spinLoader` — Custom themed loading spinner

**Component Classes (defined in `index.css`):**

- `.btn-treasure` — Primary gradient button with hover lift and shadow
- `.btn-ghost` — Secondary outlined button
- `.card` — White rounded card with warm border and shadow
- `.input-treasure` — Custom form input with gold focus glow
- `.option-card` / `.option-card.selected` — Multiple choice answer cards
- `.treasure-frame` — Gold gradient border frame for item previews
- `.stats-badge` — Pill badge with star icon for user count
- `.admin-section` — Admin form group card
- `.stat-card` — Engagement stat display with gold gradient background
- `.error-toast` — Styled error notification
- `.stagger-children` — Applies cascading fade-up animation to child elements

**Backgrounds:**

- Student view (`.bg-home`): Warm parchment base with floating semi-transparent circles and a diamond shape via CSS pseudo-elements
- Admin view (`.bg-admin`): Subtle dot-grid pattern

**Files changed:**

| File                                        | What changed                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `client/index.html`                         | Replaced Quicksand + Open Sans font imports with Righteous + Albert Sans (with `preconnect` for performance). Updated page title to "Unlock Challenge".                                                                                                                                                                                                                              |
| `client/tailwind.config.js`                 | Extended theme with custom `fontFamily` (display, body), full `colors` palette, custom `boxShadow` (card, glow, btn), and `keyframes`/`animation` definitions for all motion effects.                                                                                                                                                                                                |
| `client/src/index.css`                      | Added CSS custom properties (`:root` variables), base styles (font-family, background on `html`/`body`), heading font overrides, all component classes listed above, background pattern styles, shake/confetti/loader keyframes, stagger utility, scrollbar styling, and SDK style overrides.                                                                                        |
| `client/src/components/UnlockView.tsx`      | Complete redesign: treasure-frame item previews with gold border glow, custom option cards with SVG check indicators (hidden native inputs), inline wrong-answer feedback banner with random encouraging messages + shake animation, CSS confetti celebration + star SVG on success, custom SVG lock icon for "not configured" state, themed stats badge, loading spinner in button. |
| `client/src/components/AdminView.tsx`       | Redesigned with `.admin-section` cards for each form group, `.input-treasure` styled inputs/selects/textareas, custom SVG checkbox indicators for accessory selection, category pills, `.stat-card` engagement stats with Righteous font numbers, gold-tinted config summary card, SVG chevron for collapsible engagement section, inline SVG icons replacing text symbols.          |
| `client/src/components/PageContainer.tsx`   | Added `min-h-screen`, `max-w-lg mx-auto` centering, conditional background classes (`bg-home` vs `bg-admin`), floating diamond decorative element, `.stagger-children` wrapper for content animation. Removed `headerText` rendering (title now in child components).                                                                                                                |
| `client/src/components/Loading.tsx`         | Replaced external SDK spinner image with custom `.treasure-loader` CSS spinner. Added "Loading..." text in Righteous font.                                                                                                                                                                                                                                                           |
| `client/src/components/AdminIconButton.tsx` | Styled with theme border/background, hover effects (border color change, shadow, cog rotation), alt text, and group hover utilities.                                                                                                                                                                                                                                                 |

---

## Bug Fixes

### Error display in admin view

**Before:** The error toast only rendered inside the student view branch of `PageContainer`. When an admin triggered a validation error (e.g. forgetting to select a correct answer), the error was set in state but never displayed.
**After:** Error toast moved outside the conditional, so it renders for both admin and student views.

**File:** `client/src/components/PageContainer.tsx`

### Error handling in `getDroppedAsset`

**Before:** Used `return errorHandler()` which returned an `{error}` object. Callers would receive this object instead of a DroppedAsset, causing downstream crashes.
**After:** Calls `errorHandler()` for logging, then `throw error` so callers can catch the error properly.

**File:** `server/utils/droppedAssets/getDroppedAsset.ts`

### Stray characters in vite config

**Before:** `vite.config.ts` had stray `sk` characters after the closing `});` which caused build failures.
**After:** Removed stray characters.

**File:** `client/vite.config.ts`

---

## Backwards Compatibility

All changes maintain backwards compatibility with existing emote-only configurations:

- Data object reads use fallbacks: `gameState?.itemId || gameState?.emoteId`, `gameState?.itemDescription || gameState?.emoteDescription`, etc.
- `unlockType` defaults to `"emote"` when not present
- Legacy fields (`emoteId`, `emoteName`, `emotePreviewUrl`, `emoteDescription`, `isEmoteUnlocked`) are still returned by `handleGetEmoteUnlock.ts`
- The `initializeDroppedAssetDataObject` check accepts both old (`emoteId`) and new (`itemId`, `accessoryIds`, `unlockType`) field names

---

## Dependency Changes

| Package        | Old Version | New Version | Reason                                                                                    |
| -------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------- |
| `@rtsdk/topia` | `^0.15.8`   | `^0.19.4`   | Required for `EcosystemFactory`, `fetchInventoryItems()`, and `grantInventoryItem()` APIs |

---

## New Files

| File                                                  | Purpose                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `server/controllers/handleGetAvailableAccessories.ts` | API controller to fetch accessory packs and their items from the ecosystem inventory |
| `client/public/default-accessory-icon.svg`            | Fallback treasure box SVG icon for accessories without preview images                |
