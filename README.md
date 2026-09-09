<div align="center">
<img src="https://global-uploads.webflow.com/62e7004a0f9b3a63b980ac3c/62e70c84dd3aac06fb2ac2b6_topia-logo-blue-2x.png" style="width: 120px; margin-bottom: 20px" alt="Topia logo">
</div>

# Unlockables

## Introduction / Summary

Unlockables lets an admin turn any dropped asset in a Topia world into a challenge that grants the visitor either a **custom emote expression** or one or more **avatar accessories** once they answer correctly. The admin picks the item, writes a question, chooses a question type (text answer, open response, multiple choice, or all-that-apply), and saves. Visitors who click the asset see the item preview and the question; on a correct answer the server calls `visitor.grantExpression` (for emotes) or `ecosystem.fetchInventoryItems` + `visitor.grantInventoryItem` (for accessories), fires a Sparkle particle burst, and shows a "Congrats!" toast. Wrong answers increment a shared attempts counter and return a randomized retry message; the client shakes the card without opening the global error toast.

All state lives on a single dropped-asset data object — one challenge per dropped asset — so multiple challenges can coexist in the same world by dropping the app multiple times.

## Key Features

### Canvas elements & interactions

- **Key asset** — any dropped instance of this app. Clicking it opens the drawer with the unlock challenge (or, for admins, a toggle to the Admin/Configuration view via the gear icon).

### Visitor drawer

- **UnlockView** — renders the item preview (the emote's S3 thumbnail, or up to N accessory thumbnails in a wrap grid), the challenge question, and the answer input appropriate to `questionType`:
  - `text` — single text input, case-insensitive exact-match against `password`.
  - `open_text` — single text input, any non-empty response unlocks (response is stored on the asset for admin review).
  - `multiple_choice` — radio-style option cards; exactly one selection must match `correctAnswers[0]`.
  - `all_that_apply` — checkbox-style option cards; the selected set (sorted) must equal `correctAnswers` (sorted).
- **Wrong-answer feedback** — a random line from a 6-item pool (e.g. "Not quite! Give it another shot.") shown inline for 4 seconds; the card runs a 500 ms shake animation. The server returns HTTP 400 and the client suppresses the global error toast for that status.
- **Success state** — a full-card celebration panel (confetti + star burst) replaces the input once `profileId` appears in `stats.successfulUnlocks`. Accessory unlocks tell the visitor they may need to reload to see the new items on their avatar.
- **Not-configured state** — if no `itemId`/`accessoryIds` is saved yet, visitors see a "Not Available Yet — check back later" card instead of an input.
- **Stats badge** — `N users unlocked` count under the card whenever `stats` is populated.

### Admin features

Access via the gear icon in `PageContainer` — visible only when `visitor.isAdmin` is true. The admin gate is client-side; every server route is reachable by any authenticated visitor. The Admin view exposes:

- **Unlock Type** — `emote` or `accessory`.
- **Item selection** — for `emote`, a dropdown of the visitor's own unlockable expressions (`visitor.getExpressions({ getUnlockablesOnly: true })`); for `accessory`, a two-tier picker: pack (`AVATAR_ACCESSORY_PACK` from the ecosystem catalog) → multi-select of that pack's `ACCESSORY` items (with select-all / clear).
- **Question / Description** — free-text prompt shown to visitors.
- **Question Type** — one of `text`, `open_text`, `multiple_choice`, `all_that_apply`. Switching type resets the answer fields.
- **Answer fields** — text input (single answer), option builder (2+ options, at least one marked correct via a green checkmark button), or nothing (for `open_text`).
- **Engagement panel** — collapsible summary that shows: current configuration (type, item, question type, answer), attempt/unlock counts, and — for `open_text` — a table of every response (`displayName`, response text, sorted by `respondedAt` desc).
- **Force refresh** — appending `?forceRefreshInventory=true` to the iframe URL calls `/unlockables` with a cache-busting flag; the 6-hour in-memory `inventoryCache` is cleared on that request.

## Required Assets with Unique Names

Only the key asset needs to be placed — the app never drops assets, generates label assets, or looks anything up by `uniqueName`.

| Unique Name Pattern | Description                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none required)_   | Any dropped asset the visitor clicks becomes a challenge; state is written to that asset's data object. `credentials.uniqueName` is read but unused. |

## Technical Architecture

### Data Objects

Every route calls `getDroppedAsset(credentials)`, which runs `initializeDroppedAssetDataObject` — if none of `emoteId`, `itemId`, `accessoryIds`, or `unlockType` are present, it seeds the object with a lock-guarded `setDataObject`. New unlock schema uses the `item*` fields; legacy `emote*` fields are kept for read-side backwards compatibility and mirrored into every response payload.

#### Dropped Asset (challenge state)

```ts
{
  // New (canonical) shape
  unlockType: "emote" | "accessory";
  itemId?: string;                 // emote expression id, or first accessory id
  itemName?: string;               // display name of emote or pack
  itemPreviewUrl?: string;         // S3 URL (emote) or pack thumbnail (accessory) or default icon
  itemDescription?: string;        // the question / prompt

  // Accessory-only
  packId?: string;                 // AVATAR_ACCESSORY_PACK id
  accessoryIds?: string[];         // one or more ACCESSORY ids to grant

  // Answer validation
  questionType: "text" | "open_text" | "multiple_choice" | "all_that_apply";
  password?: string;               // only for questionType === "text" (stored lowercase, trimmed)
  options?: string[];              // multiple_choice / all_that_apply
  correctAnswers?: number[];       // indices into options[]

  // Legacy shape (still readable by getDroppedAsset, never re-written by handleUnlockConfig)
  emoteId?: string;
  emoteName?: string;
  emotePreviewUrl?: string;
  emoteDescription?: string;

  // Engagement
  stats: {
    attempts: number;              // increments on every attempt, correct or not
    successfulUnlocks: {
      [profileId: string]: { displayName?: string; unlockedAt: string /* ISO */ };
    };
    responses?: {                  // populated only when questionType === "open_text"
      [profileId: string]: { displayName: string; response: string; respondedAt: string /* ISO */ };
    };
  };
}
```

`handleGetGameState` also computes an `ecosystemAccessories` view field on the response (from the cached ecosystem inventory, filtered to `type === "ACCESSORY"`) so the client can resolve `accessoryIds` to names + preview URLs, and strips `password` and `correctAnswers` for non-admin visitors.

### Ecosystem catalog

`getCachedInventoryItems` fetches `ecosystem.fetchInventoryItems()` once every 6 hours (in-memory, single module-level `inventoryCache`). Items are sorted by `metadata.sortOrder`. `?forceRefreshInventory=true` on `/unlockables` busts the cache; on refresh failure the previous cache is returned as a stale fallback. This cache backs both the admin pack picker and the visitor-side accessory preview names.

### Real-time transport

None. All updates are HTTP request/response. The client refetches `/game-state` after each mutation.

## API Endpoints

All routes mount under `/api`. Credentials (`assetId`, `interactiveNonce`, `interactivePublicKey`, `urlSlug`, `visitorId`, plus optional `sceneDropId`, `displayName`, `identityId`, `profileId`, `uniqueName`, `username`) are injected on every request by the client-side axios interceptor and validated by `getCredentials` (which checks `INTERACTIVE_KEY === interactivePublicKey`).

| Method | Route             | Purpose                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/`               | Health probe (`{ message: "Hello from server!" }`).                                                                                                                                                                                                                                                            |
| `GET`  | `/system/health`  | App version, server start date, and echo of `NODE_ENV`, `INSTANCE_DOMAIN`, `INTERACTIVE_KEY`, `S3_BUCKET`.                                                                                                                                                                                                     |
| `GET`  | `/game-state`     | Returns `{ unlockData, isAdmin, success }`. `unlockData` merges canonical `item*` fields, legacy `emote*` mirrors, `ecosystemAccessories`, and `isItemUnlocked`. Strips `password` / `correctAnswers` for non-admins. Fires `starts` analytics on the visitor.                                                 |
| `GET`  | `/unlockables`    | Returns `{ emotes, packs, success }` for the admin picker. `emotes` are the visitor's unlockable expressions; `packs` are `AVATAR_ACCESSORY_PACK` items with their `ACCESSORY` children grouped by `metadata.packId`. Supports `?forceRefreshInventory=true`.                                                  |
| `POST` | `/unlock/attempt` | Body: `{ password?, selectedAnswers? }`. Validates the answer per `questionType`, increments `stats.attempts`, grants the emote/accessory on success, stores an `open_text` response when relevant, fires success toast + `Sparkle` particle (3s). Returns 400 with a retry-friendly message on wrong answers. |
| `POST` | `/unlock/config`  | Body: `{ unlockType, selectedEmote?, selectedAccessories?, selectedPack?, unlockCondition, itemDescription }`. Overwrites the entire challenge state. For emotes, uploads the preview PNG to S3 (`S3_BUCKET`, region `us-east-1`) and falls back to the source URL on failure.                                 |

Response payloads are stripped of `topia`, `credentials`, `jwt`, and `requestOptions` fields by the `cleanReturnPayload` middleware before send.

## Analytics

All analytics events are emitted via the `analytics: [...]` option on `updateDataObject`. `uniqueKey: profileId` deduplicates per-profile counters; the `emote_granted` and `accessory_granted` entries are pushed into the same `analytics` array as `completions` on the successful-unlock write.

| Event                | Emitted on                                            | Target       | `uniqueKey` |
| -------------------- | ----------------------------------------------------- | ------------ | ----------- |
| `starts`             | Every `GET /game-state`.                              | Visitor      | `profileId` |
| `new_configurations` | Every `POST /unlock/config` save.                     | DroppedAsset | `profileId` |
| `false_responses`    | `POST /unlock/attempt` returns 400 (wrong answer).    | DroppedAsset | `profileId` |
| `completions`        | `POST /unlock/attempt` succeeds (correct answer).     | DroppedAsset | `profileId` |
| `emote_granted`      | Successful attempt with `unlockType === "emote"`.     | DroppedAsset | `profileId` |
| `accessory_granted`  | Successful attempt with `unlockType === "accessory"`. | DroppedAsset | `profileId` |

### In-world feedback (not analytics)

| Effect                                      | Fires when                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `Sparkle` particle on visitor (duration 3s) | Emote or accessory successfully granted (not on 409 already-owned).       |
| Toast: `Congrats! Unlockablesed`            | Emote granted (non-409 response from `grantExpression`).                  |
| Toast: `Congrats! Accessories Unlocked`     | One or more accessories granted successfully.                             |
| Toast: `Already Unlocked`                   | `grantExpression` returned 409, or accessory grant threw with status 409. |

### Google Sheets analytics

`server/utils/addNewRowToGoogleSheets.ts` is present and gated on `GOOGLESHEETS_SHEET_ID`, but **is not imported by any controller at HEAD** — the `GOOGLESHEETS_*` env vars are currently no-ops. If wired up, its append row would be `[date, time, identityId, displayName, "Boilerplate", event, urlSlug]`.

## Environment Variables

Create a `.env` at the app root. See `.env-example` for a template.

| Variable                    | Description                                                                                                                                                                          | Required                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `INTERACTIVE_KEY`           | Topia interactive app key. Verified against `interactivePublicKey` on every request by `getCredentials`.                                                                             | Yes                             |
| `INTERACTIVE_SECRET`        | Topia interactive app secret. Passed to the Topia SDK client at boot.                                                                                                                | Yes                             |
| `INSTANCE_DOMAIN`           | Topia API domain (`api.topia.io` for production, `api-stage.topia.io` for staging).                                                                                                  | No (defaults to `api.topia.io`) |
| `INSTANCE_PROTOCOL`         | `https` for prod/staging, `http` only for local.                                                                                                                                     | No (defaults to `https`)        |
| `PORT`                      | Server port.                                                                                                                                                                         | No (defaults to `3030`)         |
| `NODE_ENV`                  | `development` enables permissive CORS (`localhost:3000`, `localhost:5173`) and verbose error logs. Anything else serves `client/build` as static and returns 500-only error details. | No                              |
| `S3_BUCKET`                 | S3 bucket for uploaded emote preview PNGs (`us-east-1`). Reported in `/system/health`.                                                                                               | No (defaults to `sdk-emunlock`) |
| `GOOGLESHEETS_CLIENT_EMAIL` | Google service-account email. Unused at HEAD (`addNewRowToGoogleSheets` is not called).                                                                                              | No                              |
| `GOOGLESHEETS_PRIVATE_KEY`  | Google service-account private key (`\n` escapes un-escaped at module load). Unused at HEAD.                                                                                         | No                              |
| `GOOGLESHEETS_SHEET_ID`     | Google Sheet id — when unset, `addNewRowToGoogleSheets` is a no-op. Unused at HEAD.                                                                                                  | No                              |
| `GOOGLESHEETS_SHEET_RANGE`  | Sheet range for `values.append` (defaults to `Sheet1`). Unused at HEAD.                                                                                                              | No                              |

S3 uploads use the default AWS credential chain (env / role / profile) with `region: "us-east-1"` hard-coded in `handleUnlockConfig`; no explicit `AWS_*` env vars are read by the app itself.

### Where to find `INTERACTIVE_KEY` and `INTERACTIVE_SECRET`

- [Topia Dev Account Dashboard](https://dev.topia.io/t/dashboard/integrations)
- [Topia Production Account Dashboard](https://topia.io/t/dashboard/integrations)

## Getting Started

```bash
# from the app root
npm install
cd client && npm install && cd ..

# create a .env at the app root (see Environment Variables above)
cp .env-example .env

# run the dev server (client + server together via concurrently)
npm run dev
```

The root `npm run dev` runs `npm run dev --prefix server` and `npm run dev --prefix client` in parallel. `npm run build` builds both workspaces.

## For Developers

### Built With

#### Client

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

#### Server

![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-%23000000.svg?style=for-the-badge&logo=express&logoColor=white)

### App-specific notes

- **No server-side admin gating.** `handleGetGameState` returns `isAdmin` for UI branching, but `/unlock/config` and `/unlockables` will succeed for any authenticated visitor. If admin enforcement is intended, it needs to be wired.
- **Backwards compatibility.** Data objects saved by earlier versions used `emoteId`/`emoteName`/`emotePreviewUrl`/`emoteDescription`. Both reads (`handleGetGameState`) and writes (`handleUnlockAttempt`) fall back to those fields; `handleUnlockConfig` only writes the new `item*` shape, so re-saving a legacy challenge migrates it.
- **Sparkle particle + 409 handling.** Emote grants that return 409 (already owned) fire only the "Already Unlocked" toast — no particle, no `emote_granted` analytics. Accessory grants iterate sequentially so a 409 on any accessory falls into the same "already unlocked" path.
- **S3 upload failure is non-fatal.** If the PNG fetch or `PutObjectCommand` fails, `handleUnlockConfig` stores the source `previewUrl` unchanged and logs the error.
- **Cache invalidation.** `getCachedInventoryItems` is the only path that hits `ecosystem.fetchInventoryItems()` for the admin picker; `handleUnlockAttempt` calls `ecosystem.fetchInventoryItems()` directly on every accessory unlock (bypassing the cache) to guarantee fresh grant metadata.
- **`cleanReturnPayload` middleware** strips `topia`, `credentials`, `jwt`, and `requestOptions` from every JSON response before send.

### Helpful links

- [SDK Developer docs](https://metaversecloud-com.github.io/mc-sdk-js/index.html)
- View it in action: [Dev](https://topia.io/emote-unlock-dev), [Prod](https://topia.io/emote-unlock-prod)
- [Notion One Pager](https://app.notion.com/p/topiaio/Emote-Unlock-1d040e35bdb98060a1b4e013caa6163b?v=71f6c3828d3b4f33960326f9bde24781)
