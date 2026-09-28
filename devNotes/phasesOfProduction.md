# PocketBookmark — Phases of Production

**Goal:** A frictionless, visually stunning iOS app to save, organize, and consume content from across the web and social media.

**Stack:** Swift 6, SwiftUI, SwiftData, App Groups, `FoundationModels`, `WebKit`, `AVFoundation`, `NaturalLanguage`.

**How to use this doc:** Give the agent **one phase at a time**. Each phase lists its deliverable files, the decisions already made, the known traps, and a definition of done. Do not start a phase until the previous phase's checklist passes — the traps compound.

**Current state:** Phases 0–10 + 12–23 + 25–**42** complete in code. Phase 11 device/TestFlight still ⏳. **Phase 24 CloudKit held.** Next: Phase 11 device/TestFlight manual (or Phase 24 only if asked).

**Manual step still required once:** in [Apple Developer](https://developer.apple.com/account) → Identifiers, enable App Group `group.com.Gemshi.pocketbookmark` on App IDs (`com.Gemshi.PocketBookmark`, `com.Gemshi.PocketBookmark.Share`, and `com.Gemshi.PocketBookmark.Widget`). Xcode’s Signing & Capabilities can create it if your team allows automatic management. Until that portal step is done, the on-device smoke test may report “container unavailable” and the app falls back to an in-memory store.

---

## Phase 0: Project Setup & Targets ✅

**Objective:** Get the Xcode project skeleton right before writing feature code. This is 30 minutes that saves a day.

1. ✅ App Group `group.com.Gemshi.pocketbookmark` in entitlements for app + extension (confirm in developer portal — see above).
2. ✅ Share Extension target `PocketBookmarkShare` embedded in the app; same team `BT4K8UQD9N`.
3. ✅ CloudKit entitlement present on the main app (`iCloud.com.Gemshi.pocketbookmark` in `PocketBookmark.entitlements`). Sync remains **off** for v1 — `DatabaseManager.cloudKitDatabase = .none` and every target opens the same App Group store. Share Extension / Widget do **not** yet carry iCloud entitlements; flip them atomically when enabling Phase 24 (see F1 checklist / Phase 24 note).
4. ✅ Deployment target iOS 26.0; Swift 6.0 + `SWIFT_STRICT_CONCURRENCY = complete` on both targets. Platforms narrowed to iPhone/iPad.
5. ✅ Folder structure: `Models/`, `Managers/`, `ViewModels/`, `Views/`, `Views/Components/`, `Extensions/`, `Resources/`, plus `Shared/` (compiled into both targets).

**Done when:** both targets build clean under Swift 6 strict concurrency, and a scratch test writes a file to the shared container from the app and reads it from the extension.

**Verification:** `xcodebuild -scheme PocketBookmark -destination 'generic/platform=iOS Simulator' build` succeeds. Home screen shows Phase 0 App Group status; Share sheet stub writes the extension marker.

---

## Phase 1: Data Architecture ✅

**Objective:** SwiftData models in a shared App Group container, designed to be CloudKit-compatible from the start.

**Deliverables (in `Shared/` so the extension can use them in Phase 2):** `Shared/Models/Item.swift`, `Tag.swift`, `SourcePlatform.swift`, `ItemStatus.swift`, `Shared/DatabaseManager.swift`, `Shared/AppGroup.swift`, plus `PocketBookmark/Managers/DebugSeeder.swift` and `PocketBookmarkTests/ItemRoundTripTests.swift`

1. ✅ **`Item`** — CloudKit-safe defaults/optionals; external storage for text/thumbnails; raw-string platform/status; many-to-many `tags`.
2. ✅ **`Tag`** — `name`, `isUserCreated`, inverse `items`.
3. ✅ **`SourcePlatform`** / **`ItemStatus`** — `String`-backed enums with computed accessors on `Item`.
4. ✅ **`DatabaseManager.makeContainer()`** — `groupContainer: .identifier(AppGroup.identifier)`; in-memory overload for previews/tests; app falls back to in-memory if App Group fails.
5. ✅ App wired to shared container; template `Item` stub removed.
6. ✅ DEBUG seeder inserts 20 varied items when the store is empty (Reseed toolbar button).

**Traps (honored):**
- Every property has a default or is optional; no `@Attribute(.unique)`; relationships optional with inverse.
- `#Predicate` uses raw `String` fields.
- Background work stays off `ModelContext` crossing (Phase 3 `@ModelActor`).

**Done when:** app launches against the shared container, seeder populates it, unit tests round-trip an `Item` with tags.

**Verification:** `xcodebuild … test -only-testing:PocketBookmarkTests` → TEST SUCCEEDED.

---

## Phase 2: The Share Extension ✅

**Objective:** Capture a save in under a second, from any app, without ever losing one.

**Deliverables:** `PocketBookmarkShare/ShareViewController.swift`, `SaveConfirmationView.swift`, `Info.plist`, `SharePreprocessor.js`; Shared: `URLNormalizer.swift`, `ShareSaveService.swift`, `ShareFallbackQueue.swift`, `CrossProcessNotifier.swift`; app: `InboxSyncCoordinator.swift`

1. ✅ `ShareViewController` hosts `SaveConfirmationView` (ultraThinMaterial card, spring checkmark, `.sensoryFeedback`).
2. ✅ Activation for URL, web page, and text; payload extraction + tracking-param normalization.
3. ✅ `SharePreprocessor.js` for Safari title / OG image / description / canonical URL (bare URL is the default path elsewhere).
4. ✅ Insert `status = .pending`, Darwin notify, `completeRequest` — no network/parse/AI in the extension.
5. ✅ `CrossProcessNotifier` Darwin ↔ `NotificationCenter`; inbox `.id(refreshEpoch)` refresh.
6. ✅ Duplicates bump `dateAdded` and show “Already saved — moved to top.”
7. ✅ JSON fallback queue if SwiftData/App Group fails; drained on app launch/foreground.

**Verification:** unit tests for URL normalization + save/duplicate upsert; `TEST SUCCEEDED`. Manual: share from Safari / Notes / TikTok → pending row appears after foreground.

---

## Phase 3: The Enrichment Pipeline ✅

**Objective:** Turn pending URLs into rich, offline-ready items. This is the engine room of the app.

**Deliverables:** `IngestionManager` (`@ModelActor`), `MetadataFetcher`, `ReadabilityService`, `ThumbnailService`, `ColorExtractor`, `EmbedProvider` (+ router), vendored `Resources/Readability.js`, `Item.enrichmentError`

1. ✅ `IngestionManager` drains pending/enriching items (max 3 concurrent network jobs; SwiftData writes serialized on the actor).
2. ✅ Domain triage via `EmbedProviderRouter` (YouTube/TikTok oEmbed, X/IG/Reddit OG-only, articles via fetch+Readability).
3. ✅ `MetadataFetcher` — desktop UA, 10s timeout, OG/Twitter/canonical parse + heuristic article text fallback.
4. ✅ `ReadabilityService` — single serialized offscreen `WKWebView` + Mozilla Readability; falls back to heuristics/OG.
5. ✅ `ThumbnailService` — download + JPEG downscale (max 800px).
6. ✅ `ColorExtractor` — `CIKMeans` with luma/saturation filter → `CIAreaAverage` → neutral gray; persisted on the model.
7. ✅ Wired on launch, foreground, and Darwin notify; inbox shows enriching state + tap-to-retry on failure.

**Verification:** unit tests for OG parsing + color extraction; `TEST SUCCEEDED`.

---

## Phase 4: The Masonry Inbox & Reader ✅

**Objective:** The Liquid Glass interface people screenshot.

**Deliverables:** `HomeView`, `MasonryGrid`, `ItemCardView`, `ReaderView`, `EmbedPlayerView`, `HomeViewModel`, `ReaderViewModel`, `ReaderSettings`; `Item.aspectRatio`

1. ✅ Shortest-column `LazyVStack` masonry (2 / 3 columns) — not `Layout` protocol.
2. ✅ Cards with dominant-color tint, shimmer while enriching, retry chip on failure.
3. ✅ Swipe right archive / left tags (horizontal-dominance gate) + context menu + accessibility actions.
4. ✅ Zoom navigation via `matchedTransitionSource` + `navigationTransition(.zoom)`.
5. ✅ Reader with persisted font/size/spacing/margins/themes; material bottom bar.
6. ✅ Debounced scroll progress + resume highlight + archive offer past ~95%.
7. ✅ `EmbedPlayerView` for YouTube/TikTok/generic with open-in-browser fallback.
8. ✅ Empty / enriching states; Archive toggle in toolbar.

**Verification:** `xcodebuild … build` succeeds; unit tests still pass.

---

## Phase 5: The Apple Intelligence Layer ✅ (quality hardened in Phase 16)

**Objective:** On-device tagging, extraction, and search — each with a working non-AI fallback.

**Deliverables:** `AIEngine`, Generable `SuggestedTags` / `Recipe` / `TutorialSteps` / `SearchFilter`, `SearchService`, `EmbeddingIndexer`, `ExtractedInfoView`; item fields `cachedSummary`, `extractedInfoJSON`, `embedding`

1. ✅ Availability via `SystemLanguageModel.default` — Extract Core Info hidden when unavailable.
2. ✅ Chunked map-reduce `summarize` reused for digest-ready summaries at enrich time.
3. ✅ Auto-tags from closed `PocketTagName` taxonomy (`contentTagging` use case) with heuristic fallback.
4. ✅ Reader “Extract Core Info” → recipe/tutorial sheet with copy/share; cached on the item.
5. ✅ Search: LLM → `SearchFilter` + `NLEmbedding` ranking; substring fallback always works.
6. ✅ Guardrail-friendly retries; soft fail to heuristics.

**Verification:** build + unit tests for heuristics/embeddings succeed. Field AI quality issues addressed in **Phase 16**.

### Former quality debt (fixed in Phase 16)

| Former symptom | Fix |
|---|---|
| **Summary ≈ caption** | Eligibility ≥500 chars; reject near-duplicates; Reader `displayableSummary` gate |
| **Nonsense / mismatched summary** | Boilerplate strip; title-scoped ≤4 chunks; grounding accept gate |
| **Extract → recipe for everything** | Classify-first (`ContentKind`); KeyTakeaways for articles; never Recipe-first |
---

## Phase 6: The Audio Digest Engine ✅

**Objective:** Turn the unread backlog into a personal morning podcast.

**Deliverables:** `Managers/DigestBuilder.swift`, `Managers/DigestScript.swift`, `Managers/AudioEngine.swift`, `ViewModels/AudioPlayerViewModel.swift`, `Views/DigestPlayerView.swift`, `Views/Components/MiniPlayerBar.swift`

1. ✅ **`DigestBuilder`** — unread articles from the last 48 hours; spoken segments with AI summary or clipped fallback; App Group script cache by fingerprint.
2. ✅ **`AudioEngine`** — `AVSpeechSynthesizer` with enhanced/premium voice; Personal Voice opt-in via `requestPersonalVoiceAuthorization()`.
3. ✅ **Audio session plumbing** — `.playback` / `.spokenAudio`, `UIBackgroundModes: audio`, Now Playing + remote commands, interruption and route-change handling.
4. ✅ **`MiniPlayerBar`** in a Home `safeAreaInset` on `.ultraThinMaterial`, expanding into `DigestPlayerView`.
5. ✅ Playback speed (0.75×–2×) and per-segment progress / story list.
6. ✅ Fallback when no model: TTS reads clipped article text.

**Done when:** the digest plays with the screen locked, AirPods controls work, a phone call pauses and resumes it, and skipping between stories is instant.

---

## Phase 7: System Integration ✅

**Objective:** Make the app feel like part of iOS. High value, low cost — worth its own phase.

**Deliverables:** `Managers/SpotlightIndexer.swift`, `AppIntents/`, `PocketBookmarkWidget/`, `Shared/DeepLink.swift`

1. ✅ **Spotlight** — index items as `CSSearchableItem`; deep-link via `NSUserActivity` / `pocketbookmark://item/<uuid>` into the reader; sync on enrich, archive, delete.
2. ✅ **App Intents** — “Save to Pocket Bookmark” and “Play my Daily Digest” with `AppShortcutsProvider` phrases.
3. ✅ **Widget** — unread count + next item (small/medium), deep-links into the reader; App Group store.
4. ✅ **Control Center** — `PlayDigestControl` triggers Play Daily Digest.

**Manual step:** enable App Group `group.com.Gemshi.pocketbookmark` on the new Widget App ID (`com.Gemshi.PocketBookmark.Widget`) in the developer portal if Xcode doesn’t create it automatically.

**Done when:** a saved article is findable from the iOS home-screen search field and opens directly into the reader.

---

## Phase 8: Inbox Zero & Lifecycle ✅

**Objective:** Keep the library fresh without ever making the user anxious — or losing their data.

**Deliverables:** `Managers/LifecycleManager.swift`, `Views/SettingsView.swift`, `Views/TrashView.swift`, `ViewModels/AppSettings.swift`

1. ✅ **Aging** — items past 14 days fade and group under “Aging”; dismissible Tidy Up archives the set (undoable).
2. ✅ **Auto-archive** — opt-in (default off), 7/14/30 days; archives only, never deletes.
3. ✅ **Trash** — soft-delete via `deletedAt`; 30-day retention + restore; Empty requires confirmation.
4. ✅ Lifecycle on launch/foreground; bonus `BGProcessingTask` registered (not the only path).
5. ✅ Undo toast for archive, delete, and tidy-up (~5s).
6. ✅ **Settings** — reader defaults, AI toggles, auto-archive, Personal Voice, storage clear, JSON export, Trash link.

**Done when:** no user action can permanently destroy data in fewer than two deliberate steps, and everything reversible is reversible.

---

## Phase 9: Collections ✅

**Objective:** Let people build their own shelves (Recipes, News, Weekend Reads) on top of AI tags — without turning the inbox into a filing cabinet.

**Design stance (Liquid Glass):** Collections are **user-owned shelves**, not another taxonomy. AI Tags stay closed and automatic; Collections are named, reorderable, and optional. The inbox remains the home composition — Collections are a sibling destination, not a dashboard of chips.

**Model distinction:**
| | **Tags** | **Collections** |
|---|---|---|
| Who creates | AI (+ light manual toggle) | User only |
| Vocabulary | Closed `PocketTagName` taxonomy | Free-form names (“Recipes”, “News”) |
| Purpose | Filter / search facets | Personal grouping & browsing |
| UI | Organize sheet section | Organize sheet + Collections hub |

**Deliverables:** `Shared/Models/Collection.swift`, Item↔Collection many-to-many; `Views/Collections/CollectionsView.swift`, `CollectionDetailView.swift`, `OrganizeSheet.swift`; update `ItemCardView` swipe + context menu; Spotlight keywords include collection names

1. ✅ **`Collection` model** — CloudKit-safe: `id`, `name`, `symbolName` (SF Symbol), `sortIndex`, optional accent RGB Doubles, `dateCreated`, optional inverse `items`, optional `@Attribute(.externalStorage) coverData` for the mosaic cache. No `@Attribute(.unique)`.
2. ✅ **`OrganizeSheet`** — evolve today’s tag picker into one sheet with two sections: **Tags** (closed taxonomy toggles) and **Collections** (user shelves + “New Collection…”). Same sheet from swipe-left and from context menu.
3. ✅ **Context menu** — “Add to Collection…” (opens Organize focused on Collections). Also keep / add accelerators already planned: Listen to Summary, Extract Core Info, Copy Link, Share, Delete. Swipes stay accelerators; every action remains in the menu + accessibility actions.
4. ✅ **`CollectionsView` hub** — full-bleed quiet gradient, not a stats dashboard. Hero: product-feel title “Collections”. Grid/list of glass shelf cards: **cached** mosaic cover (or symbol placeholder), name, count. Primary CTA: create collection. Long-press: rename / change symbol / delete (members stay; only membership clears). Empty state teaches “Organize any card → Collections.”
5. ✅ **`CollectionDetailView`** — masonry of members (reuse `MasonryGrid` / cards), remove-from-collection, open reader with zoom. Toolbar: rename, add from library (optional v1.1 if time).
6. ✅ **Home entry** — toolbar or bottom-adjacent control to open Collections (don’t bury only in Settings). In-app search may match collection names; system Spotlight opens a **collection** only if that collection is indexed as its own searchable item (see traps).
7. ✅ **Deep links** — `pocketbookmark://collection/<uuid>` + Spotlight collection domain; `DeepLinkRouter` pushes `CollectionDetailView`.
8. ✅ **DEBUG seeder** — a couple of sample collections with members for UI work.

**Traps:**
- Do **not** conflate `Tag` and `Collection` in one model — different ownership and UI contracts.
- Deleting a Collection never deletes Items.
- Soft-deleted / archived items: hide from Collection detail by default (or show dimmed under Archive filter later).
- Keep organize sheet medium detent + `.ultraThinMaterial`; respect Reduce Motion / Transparency.
- **Mosaic performance:** shelf cards must not decode four full `@Attribute(.externalStorage)` thumbnails on every scroll frame. Prefer a **cached composite** (`Collection.coverData` / App Group JPEG, regenerated when membership or member thumbs change) or aggressively downsampled tiles (e.g. ~64–96 pt). Never `UIImage(data:)` four large blobs inside `body` without caching.
- **Spotlight vs deep link:** adding collection names to an *item’s* `keywords` only improves item search — the continuation still opens that **item** (reader). To open a shelf, index `Collection` as its own `CSSearchableItem` (or handle `pocketbookmark://collection/<uuid>`) and route `DeepLinkRouter` → `CollectionDetailView` (zoom if we have a source; otherwise a normal push is fine). Don’t claim “Spotlight → Collection detail” if you only appended keywords on items.
- **Gesture isolation:** keep `abs(dx) > abs(dy) * 1.5` (already on cards). Vertical scroll must win when ambiguous; Organize sheet opens only after a committed horizontal swipe.

**Done when:** user can create “Recipes”, add items via swipe Organize or context menu, browse them in Collections hub, and remove/rename without losing bookmarks.

---

## Phase 10: In-App Paste & Save ✅

**Objective:** Saving shouldn’t require leaving for Safari’s share sheet — paste or type a URL inside Pocket Bookmark.

**Deliverables:** `Views/Components/AddLinkSheet.swift` (or `PasteSaveView`), toolbar entry on Home; reuse `ShareSaveService` + enrichment path

1. ✅ **Entry points** — Home toolbar `+` (primary) and empty-state CTA “Paste a link”. Optional: shake/clipboard banner when app becomes active and clipboard looks like a URL (dismissible, never sticky spam).
2. ✅ **`AddLinkSheet`** — one job: capture a URL. Large paste field, “Paste” button that reads `UIPasteboard`, optional title field, Save. Validate with `URLNormalizer`; reject non-URLs with a calm inline error (no alert storm).
3. ✅ **Save path** — call existing `ShareSaveService.save(SharePayload)` so duplicates, fallback queue, Darwin notify, and enrichment behave exactly like Share Extension saves.
4. ✅ **Feedback** — same soft haptic + brief confirmation; new item appears pending → enriching in the masonry.
5. ✅ **App Intent alignment** — “Save to Pocket Bookmark” already accepts a URL; keep phrases consistent (“Save this link…”).

**Traps:**
- Don’t reimplement enrichment in the sheet.
- Clipboard access: only on explicit Paste tap or a one-shot offer after user consent pattern (no silent clipboard reads on every frame).
- Design: sheet is a single composition (title, field, one CTA) — not a mini browser.

**Done when:** user can paste `https://…` from Notes, save, and see the card enrich without using the system share sheet.

---

## Phase 11: Polish, Accessibility & TestFlight ✅ (code) / ⏳ (device + App Store)

**Objective:** Ship quality.

1. ✅ **Haptics pass** — `.sensoryFeedback(...)` on save, swipe archive/organize, undo, trash restore, digest dismiss. Prefer the SwiftUI modifier over raw `UIImpactFeedbackGenerator`. Audit for over-buzzing; more is not better.
2. ✅ **Accessibility pass** — VoiceOver labels/hints on cards + trash; Dynamic Type–friendly card titles; `accessibilityReduceMotion` on shimmer/swipe; `accessibilityReduceTransparency` via `PocketGlass` opaque fallback; content tint opacity capped (~0.18).
3. ⏳ **Performance pass** — DEBUG **Stress500** toolbar seeds ~500 items for Instruments. **Manual:** scroll FPS, enrichment memory, cold launch on device.
4. ⏳ **Resilience pass** — **Manual on device:** airplane mode, full disk, model unavailable, malformed URLs, share burst, schema migration.
5. ✅ **Tests** — lifecycle rules + purge/auto-archive; collection membership; lexical/filter search hooks; color extractor; Readability.js bundled; existing URLNormalizer / ShareSave / metadata suites. Snapshots deferred (optional).
6. ✅ / ⏳ **App Store prep** — `PrivacyInfo.xcprivacy` declares **no tracking / no collected data** + UserDefaults reason `CA92.1`. **Manual:** App Store Connect nutrition label (“Data Not Collected”), screenshots (masonry, Collections, Cut the Fluff), metadata, TestFlight.

**Manual TestFlight checklist**
1. Archive → Distribute → TestFlight (App Store Connect).
2. Privacy nutrition: select **Data Not Collected** (on-device only; no accounts/analytics).
3. Screenshots: Home masonry, Collections shelf, Reader “Cut the Fluff,” Daily Digest player.
4. Smoke on physical device: share save, paste save, organize → collection, digest play, trash restore.

**Done when:** the resilience matrix passes clean on a physical device and the TestFlight build is live.

---

## Phase 12: Reader Metadata, Copy & Share ✅

**Objective:** Make the bookmark page feel complete as a *record* of what you saved — source, date, and one-tap copy/share — without turning the reader into a settings screen.

**Why this phase first:** Pure UI + light helpers on existing `Item` fields. Unblocks notes (Phase 13) and audio (Phase 14) by establishing a stable reader chrome (toolbar + metadata strip).

**Deliverables:** update `Views/ReaderView.swift` (header / metadata strip / toolbar); `Shared/SiteName.swift` (+ `BookmarkSavedDate`); `PocketBookmarkTests/SiteNameTests.swift`

1. ✅ **Metadata strip** — source platform (+ site name for article/other), saved date via `FormatStyle`, author when present.
2. ✅ **Copy Link** — toolbar, bottom bar, context menu; pasteboard + `.sensoryFeedback` + brief “Copied” affordance.
3. ✅ **Share bookmark** — `ShareLink` with URL + title subject/message.
4. ✅ **Accessibility** — metadata combined label; Copy/Share labels; Dynamic Type–friendly footnote/caption.

**Done when:** opening any bookmark shows source + saved date; Copy puts the URL on the clipboard; Share presents the system sheet with that URL.

---

## Phase 13: Optional Notes on Bookmarks ✅

**Objective:** Let people leave a private note on a save (“try this sauce”, “send to Sam”) without another tagging taxonomy.

**Model (CloudKit-safe):**
- ✅ `Item.notes: String?` with `@Attribute(.externalStorage)`. No `@Attribute(.unique)`. Additive migration.

**Deliverables:** `Shared/Models/Item.swift`; `Views/Components/NotesEditor.swift`; Reader wiring; DEBUG seeder sample notes; Spotlight truncated keyword; `ItemRoundTripTests` notes round-trip.

1. ✅ **Reader UI** — Notes section below metadata; “Add a note…” placeholder; debounce autosave (~400 ms) + save on disappear.
2. ✅ **Privacy** — notes stay on-device; not fed to LLMs.
3. ✅ **Organize / Collections** — notes live on Item only.
4. ✅ **Tests** — round-trip + clear notes; seeder asserts a sample note exists.

**Done when:** user can add/edit/clear a note on a bookmark and it survives relaunch.

---

## Phase 14: In-Reader Audio (Summary or Full) ✅

**Objective:** For text-heavy bookmarks (articles / long captions with offline text), offer listen-in-place: **Read summary** (AI) or **Read full** — without replacing Daily Digest.

**Relation to Phase 6:** Digest remains multi-item. Reader uses a dedicated `ReaderSpeechController` on the same `AudioEngine` patterns; cross-stop via notifications so only one narrator runs.

**Deliverables:** `ViewModels/ReaderSpeechController.swift`; `Views/Components/ReaderAudioBar.swift`; Reader Listen menu; Digest ↔ Reader stop coordination; `ReaderSpeechTests`.

1. ✅ **Listen menu** — Read Summary (cache or `AIEngine.summarize` → `cachedSummary`) / Read Full (`textContent` → description).
2. ✅ **Transport** — play/pause, skip passage, stop; glass mini bar in reader `safeAreaInset`.
3. ✅ **Audio session** — via existing `AudioEngine.configureSessionIfNeeded` / `stop` deactivate.
4. ✅ **Guardrails** — summarize already retries via heuristic fallback; soft error + offer Read Full.
5. ✅ **Settings** — Personal Voice / rate still from digest UserDefaults (`digest.usePersonalVoice`) used by `AudioEngine`.

**Done when:** on an article with text, user can Listen → Summary or Full, pause/stop, and summary generation caches for next time.

---

## Phase 15: Localization-Ready Strings ✅

**Objective:** Every user-visible string is localization-ready (String Catalog), so shipping English + future locales doesn’t require a rewrite.

**Deliverables:** `PocketBookmark/Localizable.xcstrings`, `PocketBookmarkShare/Localizable.xcstrings`, `PocketBookmarkWidget/Localizable.xcstrings`; localized `SourcePlatform` / `ItemStatus` display names; String-context call sites use `String(localized:)`.

1. ✅ **Catalogs** — English source language; project already has `LOCALIZATION_PREFERS_STRING_CATALOGS = YES`.
2. ✅ **Display names** — platform/status UI strings localized; raw SwiftData values unchanged.
3. ✅ **App / Share / Widget** — key accessibility labels, toasts, errors, share confirmation, widget copy.
4. ✅ **App Intents** — already use `LocalizedStringResource`.
5. ✅ **v1** — English only; DEBUG strings (`Reseed`, `Stress500`) left as-is.

**How to add a locale later**
1. Xcode → project → **Info** → Localizations → `+` (e.g. Spanish).
2. Open each `Localizable.xcstrings` → select language → translate values (or Export for Localization).
3. Prefer plurals / interpolations in the catalog — don’t concatenate grammar by hand.
4. Never localize stored enum raw values or user-entered notes/titles/URLs.

**Done when:** String Catalogs ship with English; main flows use localization-ready APIs; English UI still correct.

---

## Phase 16: AI Content Quality (Summaries & Extract Core Info) ✅

**Objective:** Make on-device AI output **useful or absent** — no redundant paraphrases, no hallucinated mashups, no recipe-shaped nonsense on news posts.

**Supersedes / hardens:** Phase 5 summarize + extract paths; Reader display rules for summary vs caption/body.

**Deliverables:** `ContentQuality` (or helpers on `AIEngine`) — similarity + boilerplate filters; revised `AIEngine.summarize` / `extractCoreInfo`; Generable `ContentKind` + `KeyTakeaways` (or equivalent); Reader UI gating; unit tests with fixtures (short caption, polluted HTML, recipe, CNN-style article); optional DEBUG “Regenerate AI” on reader.

### A. Field inventory (what each blob is for)

| Field | Source | User-facing role | When to generate / show |
|---|---|---|---|
| `title` | OG / Readability / platform | Primary label | Always |
| `itemDescription` | OG description / caption snippet | Card subtitle; **not** a second body on reader if equal to caption | Prefer short; strip site chrome |
| `textContent` | Readability / caption body | Reader body / Caption | Always when available |
| `cachedSummary` | AI map-reduce (or heuristic) | Digest TTS + optional “At a glance” card | Only when it **compresses** long text and **passes grounding** |
| `extractedInfo*` | User-initiated Extract | Structured how-to / takeaways sheet | Only when kind ≠ `.none` |

### B. Summary pipeline (fix Texts1 + Rep1/Rep2)

1. **Eligibility before inference**
   - Skip AI summary if cleaned body/caption length `< ~500` characters (short social posts: caption alone is enough).
   - Skip if `textContent` is missing and only a short `itemDescription` exists.
   - Prefer summarizing **Readability article text** or a cleaned caption — never raw full-page HTML leftovers.

2. **Clean before chunk**
   - Strip known boilerplate lines (e.g. “Video Ad Feedback”, cookie banners, “Related stories”, share widgets) via a small denylist + repeated-nav heuristics.
   - Drop chunks that don’t share any meaningful tokens with the **title** (or first sentence of caption) — prevents related-rail contamination.

3. **Map-reduce discipline**
   - Pass title into every map prompt: “Summarize **only** this section of an article titled ‘…’. Ignore ads and unrelated stories.”
   - Cap map chunks (e.g. 3–4) from the **primary article region**, not 6 arbitrary slices of a polluted page.
   - Reduce prompt must say: if sections disagree or look unrelated, prefer the chunk that matches the title; do not invent topics.

4. **Grounding / accept gate (after generate)**
   - Reject summary if token/Jaccard overlap with source is below a threshold **and** title keywords are missing.
   - Reject if summary is ~near-duplicate of `itemDescription` or caption (high similarity) — store `nil`, don’t show a card.
   - On reject: keep `cachedSummary = nil` (digest falls back to clipped text as today).

5. **Reader display rules**
   - Show Summary card **only** if `cachedSummary` non-nil **and** not redundant with the visible body/caption.
   - Media posts: prefer **one** text block (Caption). Summary only when it clearly shortens a long caption (e.g. caption `> 800` chars and summary ≤ ~40% length).
   - Never show Summary stacked directly above an almost-identical Caption.

### C. Extract Core Info (fix recipe bias)

1. **Classify first** — Generable `ContentKind`: `recipe` | `tutorial` | `keyTakeaways` | `none` (with `@Guide`). Input: title + short excerpt. Heuristic fallback: keyword cues (ingredients/ tbsp / bake → recipe; “step 1” / how-to → tutorial; else keyTakeaways or none).
2. **Run only the matching extractor**
   - `recipe` → existing `Recipe` schema (keep strict: real ingredient-like lines, not invented).
   - `tutorial` → `TutorialSteps`.
   - `keyTakeaways` → new `@Generable` 3–5 bullets grounded in the text (for articles/news/explainers — **not** fake recipes).
   - `none` → soft UI: “Nothing structured to extract” / hide success sheet; don’t cache junk.
3. **Never default to Recipe.** Trying recipe first is banned.
4. **Validate** — Reject recipe if ingredient lines look like prose sentences or don’t match source tokens; reject takeaways that introduce entities absent from the excerpt (light string containment check).
5. **Button affordance** — Keep hiding when model unavailable; optionally dim/disable when `ContentKind` heuristic is clearly `.none` and text is tiny.

### D. Description / card subtitle hygiene

- Treat `itemDescription` as **card teaser**, not a parallel reader section.
- If description ≈ start of `textContent` / caption, Reader should not render description separately (cards may still use a truncated teaser).
- Strip scraped UI strings during enrich (`EmbedProvider` / Readability post-process).

### E. Tests & DEBUG

- Unit: similarity/redundancy detector; boilerplate strip; classify heuristics; summary accept/reject fixtures.
- DEBUG: “Regenerate summary” / clear `extractedInfo` on reader for iteration without full reseed.

**Traps:**
- Don’t feed the whole library (or whole homepage) into one prompt — still chunked, still title-scoped.
- Don’t show empty Summary chrome.
- Don’t localize away the quality rules — they’re product logic, not copy.
- Existing bad `cachedSummary` / `extractedInfoJSON` in user stores: Phase 16 should **re-validate on display** (hide if redundant/ungrounded) and optionally clear on regenerate.

**Done when:**
1. ✅ Short Instagram-style saves show caption **or** a clearly shorter summary — not both saying the same thing.
2. ✅ A news article summary cannot drift into unrelated topics when related-rail text is present in fixtures.
3. ✅ Extract Core Info on a non-recipe article yields takeaways/tutorial/`none` — never a fake recipe by default.

**Verification:** `xcodebuild … build` / `build-for-testing` succeeded; `ContentQualityTests` cover Rep1/Rep2/Texts1-shaped fixtures (run in Xcode). Reader follow-ups landed after Phase 16: Instagram caption dedupe, article paragraph formatting, **Expand Article** when a summary is shown.

---

## Post–v1 roadmap decisions (feature intake)

These came from product review after Phase 16. Decisions below constrain Phases 17–25 — do not invent Document/PDF/Audio ingest pipelines or an open-ended AI chat UI.

### Keep / reshape

| Ask | Decision |
|---|---|
| Hybrid library: Collections + auto media types | **Yes** — Collections hub becomes a **Library** with segmented browse: **Shelves** (user Collections) \| **Types** (system filters from `SourcePlatform`). |
| AI library organize | **Yes, one-shot only (Phase 25)** — `Suggest a shelf` / tidy-tags via `FoundationModels` on a small title+excerpt batch (≤12 items). Hide when unavailable. **No conversational agent.** Cheap and efficient vs chat. |
| Better search (platform, tags) + search in Library | **Yes** — facet chips + scoped search over shelves and type views. |
| User-editable / custom tags | **Yes** — keep closed AI taxonomy *and* allow `Tag.isUserCreated` free-form tags in Organize (do **not** merge Tags into Collections). |
| Pasteboard permission spam | **Yes, high priority** — stop reading `UIPasteboard.general.string` on foreground; use `detectPatterns` + `PasteButton`. |
| Reminders on bookmarks | **Yes** — local `UNUserNotificationCenter` + `Item.reminderAt`. |
| Bulk select + Up Next (pin ≤3) | **Yes** — Select mode + `pinOrder` (1…3). |
| IAP: 20 free bookmarks | **Yes** — free tier = **20** active items (`deletedAt == nil`). StoreKit 2 non-consumable unlock. Share Extension must **never drop a save** — over-limit still captures; app shows unlock / free a slot. |
| App-wide theme | **Yes** — elevate appearance beyond Reader Settings (system / light / dark + optional reading paper/sepia for reader only). |
| CloudKit sync | **Yes (Phase 24)** — enable SwiftData + CloudKit now that the model is CloudKit-safe; iCloud account, no PocketBookmark server. |

### Avoid for now (troublesome or premature)

- **Open-ended AI chat / library co-pilot UI** — poor fit for on-device context windows; use one-shot suggest instead (Phase 25).
- **Document / Image / Audio as first-class Types** — we don’t ingest PDFs, standalone images, or podcasts yet. Types map to what we actually save: **Articles**, **Videos** (YouTube/TikTok), **Social** (Instagram/X), **Reddit**, **Other**. Adding fake empty buckets teaches users to expect features we don’t have.
- **Hard 20-save wall that rejects Share Extension** — violates “Never lose a save.” Always persist; gate unlimited library with IAP.
- **Silent pasteboard string reads** — already causes the banner; banned.

### Worth considering later (not phases yet)

- Import from Safari Reading List / Pocket / bookmarks HTML.
- PDF / file bookmark ingest → then real Document type.
- Continue-reading strip on Home (beyond Up Next pins).
- Share Extension “add to Collection” after unlock (still capture-first).

---

## Phase 17: Pasteboard Without Permission Spam ✅

**Objective:** Stop the “PocketBookmark pasted from…” banner. Saving a link stays one intentional tap.

**Root cause today:** `HomeView.considerClipboardOffer()` reads `UIPasteboard.general.string` on become-active / foreground.

**Deliverables:** update `HomeView`, `AddLinkSheet`; optional tiny `ClipboardLinkDetector` helper

1. ✅ **Remove** automatic `UIPasteboard.general.string` / `.url` reads on launch, foreground, or appear.
2. ✅ **Offer banner:** `ClipboardLinkDetector.hasProbableWebURL()` via `detectPatterns` only — banner never shows the URL. On Save → `readNormalizedURL()` once → `AddLinkSheet` prefilled.
3. ✅ **Add Link sheet:** SwiftUI `PasteButton(payloadType: String.self)` instead of reading `UIPasteboard` in a custom Paste button.
4. ✅ **Dismiss memory:** `dismissedClipboardChangeCount` (pasteboard generation), not URL string.
5. ✅ Empty-state CTA opens sheet with no clipboard probe.

**Done when:** ✅ foregrounding with a URL on the clipboard does not attribute a paste; user pastes via PasteButton or banner Save (one intentional read).

---

## Phase 18: Custom Tags (edit + add) ✅

**Objective:** AI tags stay a closed taxonomy for facets; users can also add personal tags.

**Deliverables:** `OrganizeSheet` tag section; `TagCatalog`; search/Spotlight include custom tag names; `CustomTagTests`

1. ✅ Organize: **Categories** (closed `PocketTagName` toggles) + **Your tags** + “New Tag…”.
2. ✅ Same sheet from swipe Organize / context menu (existing wiring).
3. ✅ AI `ensureTags` still `isUserCreated: false` only; never invents user tags.
4. ✅ Swipe-delete user tag removes the `Tag` (membership cleared); items remain.
5. ✅ Unit: create user tag, attach, lexical + filter search; taxonomy name collision; delete keeps item.

**Done when:** ✅ user can add “Mom’s recipes”, toggle it on a card, and find it via search.

---

## Phase 19: Library Hub — Shelves + Types + Search ✅

**Objective:** Collections destination becomes a hybrid **Library**: manual shelves plus automatic type filters; search works in Home and Library.

**UI (Liquid Glass, one composition):**
- Toolbar / segmented control on the Collections route: **Shelves** | **Types** (not a second tab bar on Home).
- **Shelves:** today’s Collections grid.
- **Types:** system smart views derived from `SourcePlatform` (and light heuristics), not user-created:
  - Articles → `.article` (+ optionally long-form `.other` with `textContent`)
  - Videos → `.youtube`, `.tiktok`
  - Social → `.instagram`, `.x`
  - Forums → `.reddit`
  - Everything else → Other
- Each type opens the same masonry language as Collection detail (reuse `MasonryGrid` / cards). Empty type views stay calm (“No videos yet”).
- Leave “Suggest a shelf” to Phase 25 (one-shot AI) — don’t block Types/search on it.

**Search:**
1. ✅ Home: keep smart search; add **facet chips** under the field — Platform, Tag (taxonomy + user), Unread / Archived — driving `SearchFilter` without requiring NL phrasing.
2. ✅ Library Shelves + Types + detail: scoped `.searchable` filtering current membership set (substring + tag/platform chips; AI interpret on Home query only — never dump whole library into the model).
3. ✅ Collection names remain searchable from Home when query matches.

**Deliverables:** ✅ `LibraryView` (Shelves | Types); `MediaTypeBrowseView` / `MediaLibraryType` + `SearchFacets`; `SearchService` scope helpers; Home `SearchFacetBar`; `LibrarySearchTests`

**Traps:** Don’t nest `NavigationStack`. Don’t claim Document/Image/Audio types. Spotlight still opens items/collections as today.

**Done when:** ✅ user switches Shelves ↔ Types, opens Videos, searches within that set by tag/platform, and Home facets filter Instagram + `#Tech` without natural language.

---

## Phase 20: Bulk Select & Up Next ✅

**Objective:** Manage many bookmarks without per-card swipe; keep up to 3 priority reads pinned above the masonry.

**Bulk Select:**
1. ✅ Home toolbar **Select** → multi-select on cards (checkmarks); toolbar: Archive, Delete (trash), Add to Collection, Pin, Done.
2. ✅ Every bulk action posts undo toast where single actions already do.
3. ✅ Accessibility: Select mode announced; cards expose selected state.

**Up Next:**
1. ✅ Model: `Item.pinOrder: Int = 0` (0 = unpinned; 1…3 = slot). CloudKit-safe default. No `@Attribute(.unique)`.
2. ✅ Home masonry: render pinned strip (max 3) above the grid, then normal inbox (exclude pins from duplicate rows).
3. ✅ Context menu / Select: Pin / Unpin; pinning a 4th auto-bumps lowest priority with undo.
4. ✅ Pins ignored when viewing Archive filter; soft-deleted / archived items lose pin.

**Deliverables:** ✅ `HomeView` select mode; `Item.pinOrder`; `UpNextStrip`; `BulkAddToCollectionSheet`; `BulkSelectAndPinTests`

**Done when:** ✅ user selects 5 cards → archive; pins 3 items that stay atop Home until unpinned.

---

## Phase 21: Bookmark Reminders ✅

**Objective:** Nudge the user to open a save later — gentle, local, dismissible.

**Deliverables:** ✅ `Item.reminderAt: Date?`; `Managers/ReminderScheduler.swift`; Reader + Organize / context menu “Remind me…”; Settings deep link to system notification auth

1. ✅ Presets: Later today / Tomorrow morning / In 3 days / Pick date & time.
2. ✅ Schedule `UNNotificationRequest` with `userInfo` item UUID → deep link `pocketbookmark://item/<uuid>`.
3. ✅ On open / archive / delete: cancel pending notification.
4. ✅ Badge optional (default off — avoid guilt engine).
5. ✅ Permission: request only when user creates first reminder; if denied, calm Settings explanation.

**Traps:** Background delivery isn’t guaranteed forever — show reminder time on the card/reader when set. No EventKit calendar spam unless user asks later.

**Done when:** ✅ user sets “Tomorrow”, locks phone, notification opens the reader; clearing the bookmark cancels the notification.

---

## Phase 22: App-Wide Appearance ✅

**Objective:** Theme isn’t only a reader chrome setting — Home, Library, Settings respect a global appearance.

**Deliverables:** `AppAppearance` on `AppSettings`; Settings Appearance section; apply at `PocketBookmarkApp` via `.preferredColorScheme` + reader still owns paper/sepia/black for **reading surface only**

1. ✅ Global: System / Light / Dark (`AppAppearance`, persisted `app.appearance`).
2. ✅ Reader themes (Sepia / Paper / Black) remain **reader-only** — don’t force sepia on the whole masonry.
3. ✅ Honor Reduce Transparency (`PocketGlass`); keep content-derived card tints capped.
4. ✅ Persist in UserDefaults (same pattern as reader settings).

**Done when:** ✅ choosing Dark in Settings makes Home + Collections dark without opening a bookmark; reader Black still works inside ReaderView.

---

## Phase 23: Unlimited Unlock (StoreKit 2) ✅

**Objective:** Free tier to try the app; non-consumable IAP unlocks unlimited library.

**Product rules:**
- Free: **20** active items (`deletedAt == nil`). Archived still count toward the 20 unless playtesting later chooses “archive frees a slot” — document any change in code.
- Soft cap (“Never lose a save”): **always accept Share / Paste saves**; when over 20, item is saved but Home shows an unlock banner and may pause further enrichment until unlock or until the user deletes/trashes enough to free slots. Never fail `completeRequest` in the extension because of IAP.
- Paid: non-consumable `pocketbookmark.unlimited` (final ID in App Store Connect).
- Restore Purchases in Settings. No accounts.

**Deliverables:** `Managers/EntitlementsStore.swift` (StoreKit 2); `UnlockUnlimitedSheet`; `Shared/FreeTierPolicy.swift`; Home unlock banner; Settings purchase + restore; DEBUG unlock override; `Configuration.storekit`

1. ✅ Soft free cap at **20** active items — saves never rejected.
2. ✅ Home banner when over cap; paywall sheet + Restore.
3. ✅ Auto-enrichment paused for overflow (oldest 20 keep enriching); manual retry still allowed.
4. ✅ Settings → Pocket Unlimited; DEBUG Force Unlimited toggle.
5. ✅ Unit tests for free-tier policy.

**Traps:** Extension cannot present paywall — only main app. Don’t block Darwin notify. Privacy nutrition still “Data Not Collected” (StoreKit is Apple-mediated). TestFlight Sandbox. Attach `Configuration.storekit` to the scheme for local StoreKit testing. Create the product in App Store Connect before shipping.

**Done when:** ✅ 21st save still lands; unlock removes banner; restore path wired (Sandbox / TestFlight with real product).

---

## Phase 24: CloudKit Sync ⏸️ HELD

**Objective:** Sync the library across the user’s Apple devices via iCloud — still no PocketBookmark server or accounts.

**Status:** Container ID `iCloud.com.Gemshi.pocketbookmark` is registered on the **main app** entitlements, and Settings/`CloudSyncMonitor` scaffolding exists — but **sync is not enabled**. Remediation F1 collapsed every target onto one App Group store with `DatabaseManager.cloudKitSyncEnabled = false`. Do not resume this phase unless asked.

**Why held:** Enabling CloudKit while the Share Extension and Widget open the store with different `ModelConfiguration` options is a documented Core Data failure. F1 removed the split-store bug; turning sync on must be atomic across all three targets.

### Enabling checklist (do all at once)

1. Flip `DatabaseManager.cloudKitSyncEnabled` to `true` (sets `cloudKitDatabase` to `.private("iCloud.com.Gemshi.pocketbookmark")`).
2. Add `com.apple.developer.icloud-container-identifiers` and `com.apple.developer.icloud-services` to **both** `PocketBookmarkShare.entitlements` and `PocketBookmarkWidget.entitlements` (main app already has them).
3. Enable the iCloud container on all three App IDs in the developer portal.
4. Re-verify Share → app → widget on a signed-in device pair.

**Prior scaffolding (kept, not active sync):**
- Settings iCloud section via `CloudSyncMonitor` (reports Local only while `cloudKitDatabase == .none`)
- `InboxSyncCoordinator` observes `NSPersistentStoreRemoteChange` (meaningful once a single store is shared; required again when CloudKit merges land)
- `ReminderScheduler.reconcileAll(in:)` for device-local notification rebuild after imports
- `CloudKitSmokeTests` assert App Group URL + `cloudKitSyncEnabled == false` (not a live CloudKit container)

**Traps:**
- Don’t assume SwiftData auto-merges extension writes — Darwin + foreground refresh stay.
- Reminders (`UNUserNotificationCenter`) are **device-local** — synced `reminderAt` on `Item` must trigger `ReminderScheduler.reconcileAll(in:)` on every CloudKit import.
- Widget timeline: reload via `WidgetReloader` / `WidgetCenter` on import and foreground.
- Xcode strict concurrency: `@Observable` classes with `NotificationCenter` observers must avoid non-isolated `deinit` actor hops.

**Done when:** (deferred) Two signed-in devices share the same library; turning off iCloud leaves a usable local copy; Share Extension saves still never get lost — and all three targets open the store with identical CloudKit options.

---

## Phase 25: Library Assistant (one-shot suggest) ✅

**Objective:** When Apple Intelligence is available, offer **performance-efficient one-shot** help — not a chat. Suggest a Collection from unread items (or propose tag tidy) with user confirmation.

**Why one-shot (efficient):** One constrained `@Generable` call on ≤12 titles + short excerpts stays inside the on-device token budget, avoids multi-turn sessions, and degrades cleanly when the model is unavailable (hide the control).

**Deliverables:** `AIEngine.suggestCollection(...)`; `SuggestedShelf.swift` (`@Generable`); `SuggestShelfSheet`; Library toolbar sparkles entry; hide when model unavailable; never auto-mutate without confirmation

1. ✅ Input: titles + short excerpts of up to ~12 unread items, not full bodies.
2. ✅ Output: `@Generable` proposed name + symbol index + member numbers → user confirms / edits in sheet.
3. ✅ Fallback: hide toolbar button when AI unavailable or fewer than 3 unread; soft-fail sheet if inference fails.

**Done when:** ✅ with AI on, user can accept a suggested shelf; with AI off, no dead control.

---

## Phase 26: Settings Finish & Store Presence ✅

**Objective:** Finish and fine-tune Settings into a ship-ready surface — legal, support, about, discovery, and ratings — with clear Apple Intelligence status when the model isn’t available.

**Deliverables:** Settings sections (About / Support / Legal / More); remote or in-app Privacy Policy + Terms of Use; Support link; Other Apps / developer link; Rate the App; `SKStoreReviewController` request policy; Apple Intelligence unavailable table/row; version/build About; calm layout pass (match `bgColor` / glass already in Settings)

1. ✅ **Apple Intelligence status** — Quiet non-interactive row when unavailable + footer that tagging/summaries/search fall back to heuristics. Toggles when available.
2. ✅ **About** — App name, on-device blurb, version/build, Acknowledgements (Readability).
3. ✅ **Support** — mailto `PocketExternalLinks.supportEmail`.
4. ✅ **Legal** — In-app Privacy Policy + Terms (`LegalDocumentView`); hosted URL hooks in `PocketExternalLinks` for App Store Connect.
5. ✅ **Rate the App** — Settings “Rate Pocket Bookmark” (write-review URL when Apple ID set, else `requestReview`). Auto prompt via `ReviewPromptPolicy` after ≥5 successful saves and ≥3 days since install (120-day cool-down); never first launch. Home defers ~1.8s (debounce) after save / Share refresh / successful digest build / unlock so the system dialog doesn’t collide with toasts.
6. ✅ **Other apps** — “More Apps” App Store search row.
7. ✅ **Layout polish** — Appearance → Unlimited → Reader → Apple Intelligence → Lifecycle → Speech → Reminders → Storage → Library → iCloud → About / Support / Legal / Rate.
8. ✅ **Haptics** — soft feedback on Rate tap.

**Traps honored:** AI unavailable is informational; legal copy ships in-app (host URLs when ready); review prompt from saves, not Settings open.

**Done when:** ✅ Settings shows AI unavailable status; Privacy, Terms, Support, About, Rate, and Other Apps reachable; review policy unit-tested.

**Status:** Done (2026-09-15).

---

## Phase 27: TipKit Discoverability ✅

**Objective:** Teach the gestures and buried power features that already exist — without a tour modal, without nagging, and without pointing at chrome that is currently hidden (AI-gated controls).

**Why now:** The app is feature-complete for daily use (Phases 0–10, 12–25). Discoverability gaps are the remaining “I didn’t know I could…” pain. TipKit is the system-native fit: event-driven, dismissible, respects Reduce Motion, and stays out of Share Extension / Widget.

### Audit snapshot (code as of 2026-09-15) — gaps that drive this phase

| Gap | Severity | Today’s discovery path |
|-----|----------|------------------------|
| Card swipe → Archive | **High** | Gesture only (+ VoiceOver hint). |
| Card swipe → Organize | **High** | Gesture only (`dx < -64`). Context menu duplicates; no first-run teaching. |
| Daily Digest | **High** | Home action-bar `…` only (+ App Intent / widget / deep link). |
| Pin → Up Next (max 3) | **High** | Long-press or Select → Pin. Strip label quiet. |
| Suggest a Shelf | **High** | Library sparkles — only when AI available **and** ≥3 unread. |
| Extract Core Info | **Med** | Reader toolbar — only when AI + eligible article text. |

Other gaps (Remind, Select, Reader Settings, Listen, Unarchive, Trash, Auto-archive, mini-player dismiss, unlock) stay taught by existing chrome / empty states / banners — **out of TipKit scope for v1 of this phase**.

**Known product footgun (fix outside TipKit if still true):** Collection / Tag / Type browse may pass empty `onArchive` while the card still swipes — tip cannot paper over a no-op. Verify Home is the only place Archive swipe commits before shipping archive tips.

### Principles (hard rules)

1. **Tips teach existing actions** — never invent UI the tip describes.
2. **One tip at a time** — TipKit display frequency / group; never stack overlays.
3. **Anchor only to stable chrome** — see Masonry Safety below. Never tip a hole (hidden AI button).
4. **Event-driven, not tour** — TipKit `Event` donations after real user moments. No multi-page onboarding.
5. **Swift 6 concurrency-safe rules** — **no** `@Parameter static var` (mutable statics fight `SWIFT_STRICT_CONCURRENCY = complete`). Prefer `Tips.Event` donations + `#Rule` on event counts.
6. **Invalidate on success** — after the taught action, invalidate that tip.
7. **Share Extension / Widget** — no TipKit (main app only).
8. **English copy** with `String(localized:)`; glass-quiet; no purple / emoji / guilt.

### Masonry Safety (hard rule — do not violate)

**Do NOT** attach `.popoverTip` (or any TipKit popover) to cells inside `MasonryGrid`, `LazyVStack` columns, or `ItemCardView` itself.

**Why:** TipKit measuring / presenting against lazily sized masonry cells causes **infinite layout flutter** (tip ↔ cell remeasure loop) and looks broken even when it “works.”

**Required approach for card-gesture tips (Archive / Organize / Pin):**

| Approach | Use when | Notes |
|----------|----------|-------|
| **A. Inline `TipView` above the grid** (preferred for swipe tips) | Home inbox has content | Place a quiet glass strip in the **same** `VStack` as brand / clipboard / unlock banners — **outside** `MasonryGrid`. Tip copy refers to cards below (“Swipe a card right…”). Stable layout; matches Liquid Glass; no lazy remeasure. |
| **B. `.popoverTip` on non-lazy chrome** | Digest, Suggest, Extract, Pin | Anchor to Home `…`, Library sparkles, Reader Extract button, or restored **Up Next** header — never a masonry cell. |

**Design bar for Approach A:** one compact tip row (system `TipView` or thin custom glass) that collapses when invalidated — not a hero card, not a modal, not a floating arrow into a random thumbnail.

**Pin tip:** prefer Approach B on a restored “Up Next” label / strip chrome; if the strip is empty, fall back to Approach A inline tip above the grid (still not on a cell).

### Swift 6 Safety (hard rule)

```swift
// ❌ BAD — mutable static @Parameter under strict concurrency
@Parameter
static var hasSavedBookmark: Bool = false

// ✅ GOOD — TipKit Event donations (Sendable-friendly)
static let itemSaved = Tips.Event(id: "pocket.itemSaved")
static let archivedItem = Tips.Event(id: "pocket.archivedItem")

var rules: [Rule] {
    #Rule(Self.itemSaved) { $0.donations.count >= 1 }
    #Rule(Self.archivedItem) { $0.donations.count < 1 } // still teach until they archive
}
```

- Donate from `@MainActor` UI / view-model paths only (`HomeView` save toast, archive handlers, pin, digest play, extract open) — not from `@ModelActor` ingestion.
- Invalidate with `tip.invalidate(reason: .actionPerformed)` when the taught action completes (in addition to event rules where useful).

### Scope (ship exactly these six — nothing else)

**P0 (required):**
1. `CardSwipeArchiveTip`
2. `CardSwipeOrganizeTip`
3. `DailyDigestTip`
4. `PinUpNextTip`

**P1 (required, gated):**
5. `SuggestShelfTip`
6. `ExtractCoreInfoTip`

**Explicitly dropped for this phase:** ReaderSettingsTip, ListenTip, RemindMeTip, SelectBulkTip, and all former P2 tips (Unarchive, Trash, AutoArchive, UnlockSoft, MiniPlayerDismiss, PinCap). Revisit only if TestFlight still shows confusion.

### Deliverables

| File / area | Role |
|-------------|------|
| `PocketBookmark/Tips/PocketTips.swift` | The **six** `Tip` types + `Tips.Event` IDs + rules / `MaxDisplayCount` |
| `PocketBookmark/Tips/PocketTipCenter.swift` | `Tips.configure` at launch; `@MainActor` donate / invalidate helpers; DEBUG `Tips.resetDatastore()` |
| `HomeView` | Inline `TipView` host **above** masonry for swipe tips; `.popoverTip` on `…` for Digest; Pin tip on Up Next chrome or inline host; donate/invalidate on save / archive / organize / pin / digest |
| `UpNextStrip` | Restore quiet **“Up Next”** label (non-TipKit polish) so Pin tip has a stable anchor |
| `LibraryView` | `.popoverTip` on sparkles **only** when `canSuggestShelf` |
| `ReaderView` | `.popoverTip` on Extract button **only** when that control is in the hierarchy |
| Manual / DEBUG | Reset TipKit control; checklist below |

**Do not** add TipKit to `ItemCardView`, `MasonryGrid`, Collection/Tag browse grids, or Share Extension.

**TipKit APIs:** `Tip`, `Tips.Event`, `#Rule`, `TipView`, `.popoverTip` on **stable** anchors only, `Tips.configure`, invalidate-on-action. Target iOS 26.

### Tip catalog (the six)

Priority when multiple eligible: Archive → Organize → Digest → Pin → Suggest → Extract. Still **at most one** visible.

1. **`CardSwipeArchiveTip`**
   - **Title:** “Swipe to Archive”
   - **Message:** “Swipe a card right to clear your inbox. Undo appears at the bottom.”
   - **Presentation:** Inline `TipView` above masonry (Approach A). **Never** on a card.
   - **Events:** require `itemSaved` (≥1); hide after `archivedItem` donated or invalidate on archive.
   - **Don’t show:** Select mode, Archive mode, empty inbox.

2. **`CardSwipeOrganizeTip`**
   - **Title:** “Swipe to Organize”
   - **Message:** “Swipe left for shelves, tags, and Remind Me — same sheet as long-press Organize.”
   - **Presentation:** Inline `TipView` above masonry (Approach A).
   - **Events:** after archive tip done / invalidated; require `itemSaved`; invalidate on Organize sheet open (`organizedItem` event).

3. **`DailyDigestTip`**
   - **Title:** “Daily Digest”
   - **Message:** “Under More (⋯), Play Digest narrates unread articles from the last 48 hours.”
   - **Presentation:** `.popoverTip` on Home action-bar ellipsis (stable chrome).
   - **Events:** `itemSaved` ≥1 (or home has content); invalidate / `digestPlayed` when digest builds or plays.
   - **Don’t show:** while mini player already visible.

4. **`PinUpNextTip`**
   - **Title:** “Pin to Up Next”
   - **Message:** “Long-press a card → Pin to top. Up to three stay above your inbox.”
   - **Presentation:** `.popoverTip` on restored Up Next header if strip visible; otherwise inline `TipView` above masonry — **not** on a pinned card cell.
   - **Events:** invalidate / `itemPinned` on first pin.

5. **`SuggestShelfTip`**
   - **Title:** “Suggest a Shelf”
   - **Message:** “Apple Intelligence can propose a collection from your unread bookmarks — you confirm before anything is created.”
   - **Presentation:** `.popoverTip` on Library Shelves sparkles.
   - **Rules:** tip modifier exists **only** when `canSuggestShelf == true`. Invalidate when Suggest sheet opens.
   - **Critical:** if the button is hidden, do not mount TipKit on a placeholder.

6. **`ExtractCoreInfoTip`**
   - **Title:** “Extract Core Info”
   - **Message:** “Pull recipes, steps, or key facts into a clean list — on-device only.”
   - **Presentation:** `.popoverTip` on Extract toolbar button when visible.
   - **Rules:** mount only with the button (`aiAvailable` + eligible text). Invalidate when extract sheet opens.

### Explicit non-tips (do not TipKit)

- Share Extension save flow, clipboard / unlock / Tidy Up / Aging banners
- MediaHero CTAs, search facets, Notes, Copy Link, Share
- Reader Settings, Listen, Remind Me, Select bulk, Unarchive, Trash, Auto-archive, mini-player dismiss, pin-cap toast
- DEBUG Reseed / Stress / Force Unlimited
- Any masonry / lazy cell

### Implementation sketch

```swift
import TipKit

struct CardSwipeArchiveTip: Tip {
    static let itemSaved = Tips.Event(id: "pocket.itemSaved")
    static let archivedItem = Tips.Event(id: "pocket.archivedItem")

    var title: Text { Text("Swipe to Archive") }
    var message: Text? {
        Text("Swipe a card right to clear your inbox. Undo appears at the bottom.")
    }
    var image: Image? { Image(systemName: "archivebox") }

    var rules: [Rule] {
        #Rule(Self.itemSaved) { $0.donations.count >= 1 }
        #Rule(Self.archivedItem) { $0.donations.count < 1 }
    }
    var options: [TipOption] { [MaxDisplayCount(2)] }
}

// Home — ABOVE MasonryGrid, never inside it:
if !viewModel.isSelecting, !viewModel.showArchived {
    TipView(CardSwipeArchiveTip())
        .tipViewStyle(.automatic)
}
```

- Configure once at launch: `try? Tips.configure([.displayFrequency(.daily)])` (tune as needed).
- Donate examples (`@MainActor`):
  - save success → `CardSwipeArchiveTip.itemSaved.sendDonation()`
  - archive → `CardSwipeArchiveTip.archivedItem.sendDonation()` + invalidate archive tip
  - organize sheet → organize event + invalidate organize tip
  - pin → pin event; digest play → digest event; extract / suggest open → invalidate those tips
- Style: system TipKit is fine; if customizing, match `bgColor` / ultraThinMaterial — no brand purple.

### Testing & DEBUG

1. DEBUG Settings (or `#if DEBUG` control): **Reset TipKit** → `Tips.resetDatastore()`.
2. Fresh install → save one link → Archive inline tip above grid (no flutter while scrolling) → swipe archive → Organize tip → Dig… tip on `…` → pin tip.
3. AI off: Suggest / Extract tips never appear.
4. Scroll masonry aggressively with tip visible — **no layout thrash / flicker**.
5. Select mode: hide inline tip host.
6. VoiceOver: tips don’t trap focus; Pin/Remind remain on context menu (bonus: add a11y actions).

### Bonus polish (same phase if cheap)

- Restore visible **"Up Next"** label on `UpNextStrip`.
- VoiceOver actions for **Pin** and **Remind** on `ItemCardView`.
- Confirm Collection/Tag browse Archive swipe is wired or disabled — don't tip a no-op.

### Traps

- **Masonry `.popoverTip`** → layout flutter — forbidden.
- **`@Parameter static var`** → Swift 6 / strict concurrency hazard — use `Tips.Event` instead.
- TipKit on a view that isn't on screen → broken; gate with the same `if` as the control.
- Tip spam every launch — `MaxDisplayCount` + invalidate + events.
- Don't block Phase 26 legal work on TipKit; don't use tips for paywall pressure.
- Don't expand scope past the six tips in this phase.

**Done when:**
- [x] Fresh install teaches Archive swipe, Organize swipe, Daily Digest location, and Pin — without masonry flutter.
- [x] Suggest Shelf and Extract tips appear only when those controls exist.
- [x] All tip rules use `Tips.Event` (no mutable static `@Parameter`).
- [x] DEBUG can reset tip state; Select mode / Reduce Motion don't break interaction.
- [x] No `.popoverTip` on `MasonryGrid` / `ItemCardView` / lazy cells.

**Status:** Done (2026-09-15). Six tips + Event donations; inline `TipView` above Home masonry; popovers on `…` / Up Next / Library sparkles / Reader Extract; Up Next label restored; browse grids archive swipe wired; DEBUG Reset TipKit.

---

## Phase 28: Retry Enrichment & Edit Thumbnail ✅

**Objective:** Expose "Retry Enrichment" and "Edit Thumbnail" actions on bookmark cards, gated behind pro/free-limit status. Edit Thumbnail lets users insert their own image (compressed by the app).

**Gating:** Both actions are **hidden** (not disabled) when `!entitlements.isEffectivelyUnlocked && FreeTierPolicy.isOverFreeCap(...)`. Retry also requires `item.status == .failed`.

**Deliverables:** `Views/Components/EditThumbnailSheet.swift` [NEW]; updates to `ItemCardView.swift`, `HomeView.swift`, `CollectionDetailView.swift`, `MediaTypeBrowseView.swift`, `TagBrowseView.swift`

1. `ItemCardView` — new `canUseProFeatures: Bool` parameter; new `onEditThumbnail` callback; context menu gains "Edit Thumbnail" (`photo.badge.plus`) when `canUseProFeatures && item.status == .ready`, and "Retry Enrichment" gated behind `canUseProFeatures && item.status == .failed`; accessibility actions added.
2. `EditThumbnailSheet` — `PhotosPicker` (from `PhotosUI`) to choose an image; compresses via `ThumbnailService.downscale(_:maxPixelSize:)` at 800 px; saves to `item.thumbnailData`; recomputes dominant color via `ColorExtractor`; updates `aspectRatio`; refreshes any `CollectionCoverBuilder.refreshCover(for:)` covers; "Reset to Original" re-runs enrichment for thumbnail only.
3. Parent views (`HomeView`, `CollectionDetailView`, browse views) — compute `canUseProFeatures` from `EntitlementsStore` + `FreeTierPolicy`; add `@State editThumbnailItem: Item?`; present `EditThumbnailSheet`; wire `onEditThumbnail` callback.
4. Existing inline "Tap to retry" chip stays ungated on `.failed` items; `isEnrichmentPaused` already shows "Unlock to enrich".

**Traps:**
- Never replace `thumbnailData` with an uncompressed image — always downscale.
- Dominant color must be recomputed from the new image, not left stale.
- Collection covers that include the item must refresh.
- `PhotosPicker` requires `import PhotosUI`; no privacy prompt needed for PHPicker.

**Done when:** pro user can edit a bookmark's thumbnail from library; free user over cap sees no Edit Thumbnail / Retry in context menu; custom thumbnail survives relaunch; collection covers refresh.

**Status:** Done (2026-09-15). `EditThumbnailSheet` (PhotosPicker → 800px downscale → dominant color / aspect / collection covers); context-menu Edit Thumbnail + Retry Enrichment gated by `canUseProFeatures`; inline Tap to retry stays ungated; `IngestionManager.refreshThumbnail` for Reset to Original.

---

## Phase 29: Sub-Collections & Custom Collection Thumbnails ✅

**Objective:** Allow collections to have child sub-collections (one level deep, acting as sub-folders). Allow users to optionally set a custom thumbnail for any collection cover (keeping the auto-mosaic as default).

**Model (CloudKit-safe):**
- `BookmarkCollection.parent: BookmarkCollection?` — optional self-referential.
- `@Relationship(inverse: \BookmarkCollection.parent) var children: [BookmarkCollection]?` — inverse.
- `@Attribute(.externalStorage) var customCoverData: Data?` — user-chosen cover (separate from auto-mosaic `coverData`).
- Computed `displayCover: Data?` → `customCoverData ?? coverData`.
- Computed `isSubCollection: Bool` → `parent != nil`.
- **Depth:** one level only. Sub-collections cannot have children (UI-enforced).

**Deliverables:** `Collection.swift` model update; `EditCollectionCoverSheet.swift` [NEW]; updates to `LibraryView.swift`, `CollectionDetailView.swift`, `OrganizeSheet.swift`; deep links work unchanged; `DebugSeeder` sample sub-collections

1. **`Collection.swift`** — add `parent`, `children`, `customCoverData` fields. All optional with defaults.
2. **`LibraryView` (Shelves)** — show only top-level collections (`parent == nil`); child-count badge on parent cards; long-press gains "Add Sub-Collection…" (top-level only) and "Edit Cover…".
3. **`CollectionDetailView`** — sub-collections strip at top (horizontal scroll of child shelf cards) when viewing a parent; tapping navigates into child's `CollectionDetailView`; toolbar "Add Sub-Collection" (only when `collection.parent == nil`); toolbar "Edit Cover…".
4. **`OrganizeSheet`** — collections section groups top-level with indented sub-collections below. Items can be added to sub-collections directly.
5. **`EditCollectionCoverSheet`** — `PhotosPicker`; compress via `ThumbnailService.downscale`; save to `customCoverData`; "Reset to Auto" clears `customCoverData` and regenerates `coverData`.
6. **Spotlight / deep links** — `pocketbookmark://collection/<uuid>` already works for sub-collections (same model).

**Traps:**
- Sub-collections must not have children — guard in UI and in any create helper.
- Deleting a parent collection: decide behavior — orphan children to top-level, or delete children too. **Recommend:** orphan to top-level (never lose shelves).
- `coverData` auto-mosaic continues to regenerate from members; `customCoverData` is user-set and survives member changes.
- Migration: additive fields with defaults — no destructive migration.

**Done when:** user can create a sub-collection inside "Recipes", add items, browse parent → child; custom cover shows on Library shelf card; deleting parent orphans children to top-level.

**Status:** Done (2026-09-15). Additive `parent` / `children` / `customCoverData` + `displayCover`; Library top-level only with child badge + Add Sub-Collection / Edit Cover; detail strip + toolbar; Organize indented; `EditCollectionCoverSheet`; delete orphans children; DebugSeeder Baking / Weeknight under Recipes.

---

## Phase 30: Long-Press Card Expand ✅

**Objective:** On long press of a bookmark card, slightly expand it so users can read more text — only if safe and won't break the masonry layout or cause performance issues.

**Approach: Context Menu "Show More" → Overlay (safest)**

Add a "Show More" action to the existing context menu. When tapped, show a centered overlay card with:
- Full title (no line limit)
- Full description (no line limit)
- Larger thumbnail
- Source, date, tags
- Tap outside to dismiss

This is a **zero-risk approach** — no masonry remeasure, no gesture conflicts with existing swipe/context-menu.

**Deliverables:** `Views/Components/ExpandedCardOverlay.swift` [NEW]; updates to `ItemCardView.swift`, `HomeView.swift`

1. **`ExpandedCardOverlay`** — full-screen dimmed overlay with a centered glass card (~80% width); shows the item's full title, description, thumbnail (larger), platform badge, tags, notes preview, reminder; dismiss on tap outside or "Close" button; spring animation in/out; respects `accessibilityReduceMotion`.
2. **`ItemCardView`** — context menu gains "Show More" (`arrow.up.left.and.arrow.down.right`) — always available (not pro-gated); new `onShowMore: (() -> Void)? = nil` callback.
3. **`HomeView`** — `@State expandedItem: Item?`; present `ExpandedCardOverlay` as a `ZStack` overlay (not a sheet — smoother animation); wire `onShowMore`.
4. **Browse views** — same wiring where `ItemCardView` is used.

**Traps:**
- Do **not** use `scaleEffect` on the card inside the masonry — it would overlap neighbors and cause visual bugs during scroll.
- Do **not** add a separate `LongPressGesture` — it conflicts with the system context menu.
- Overlay must not interfere with the navigation stack or deep links.
- Keep overlay lightweight — single item, no `@Query`, no model writes.

**Done when:** user long-presses a card → context menu → "Show More" → overlay shows full text → tap outside dismisses; no masonry flutter; works in all browse views.

**Status:** Done (2026-09-15). Context-menu Show More → `ExpandedCardOverlay` (glass card, full title/description/tags/notes/reminder); wired on Home + collection/type/tag browse; no masonry scale / no extra long-press gesture.

---

## Phase 31: Collection Free Limit (50 Bookmarks) ✅

**Objective:** Free users can add at most **50 total unique bookmarks** across all collections combined. Pro users have no limit. Separate from the existing 20-active-item inbox cap.

**Policy:**
- Count: unique items with `deletedAt == nil` that belong to **at least one** collection. An item in 3 collections counts as 1.
- Over-cap: adding new items to collections is blocked with a calm inline message + unlock offer. Removing from collections is never gated.
- Existing memberships over 50 (from before this phase) remain — cap only blocks new additions.

**Deliverables:** `FreeTierPolicy.swift` update; `OrganizeSheet.swift`, `BulkAddToCollectionSheet.swift`, `HomeView.swift` updates; `FreeTierPolicyTests` new cases

1. **`FreeTierPolicy`** — `static let freeCollectionItemLimit = 50`; `isOverCollectionCap(collectionMemberCount:isUnlocked:) -> Bool`; `collectionMemberCount(in items: [Item]) -> Int` counts unique items in ≥1 collection with `deletedAt == nil`.
2. **`OrganizeSheet`** — before toggling collection membership on, check cap; if over: inline banner "Free limit reached (50 bookmarks in collections). Unlock Unlimited for more." + unlock sheet button; removing always allowed.
3. **`BulkAddToCollectionSheet`** — same cap check before bulk-adding; warn how many of the selection would exceed the cap.
4. **`HomeView`** / context menu — "Add to Collection" aware of cap; shows unlock sheet if over.
5. **Tests** — `FreeTierPolicyTests`: at 49 → allow; at 50 → block; unlocked → always allow; removing → always allow; unique count (item in 2 collections = 1).

**Traps:**
- Don't conflate with the 20-active-item inbox cap — these are independent limits.
- Never reject or delete existing memberships when the cap is reached retroactively.
- Share Extension never touches collection membership — cap is main-app only.
- Count must be efficient: avoid O(N×M) scan of all items × all collections on every organize open.

**Done when:** free user hits 50 unique items in collections → next add shows unlock prompt; removing items from collections works regardless; unlocked user has no limit.

**Status:** Done (2026-09-15). `FreeTierPolicy.freeCollectionItemLimit = 50` + unique-member count; Organize / Bulk Add gate first-time joins with inline unlock; removals + already-membered adds stay free; Home “Add Collection” opens unlock when over cap for non-members; FreeTierPolicyTests cover 49/50/unlocked/unique.

---

## Phase 32: Onboarding Page ✅

**Objective:** A first-launch onboarding flow highlighting key features and showing the easy way to add bookmarks using the Share Sheet.

**Design:** Multi-page horizontal `TabView` (`.tabViewStyle(.page)`) with 4–5 slides, Liquid Glass styling, page indicator dots, Skip button.

**Deliverables:** `Views/OnboardingView.swift` [NEW]; `PocketBookmarkApp.swift` or `HomeView.swift` update; `SettingsView.swift` DEBUG reset

1. **Slide 1 — Welcome** — App icon (large SF Symbol `bookmark.fill`), app name, tagline "Save anything. Read later. Stay organized." Clean, brand-calm.
2. **Slide 2 — Share Sheet** — Step-by-step visual guide:
   - "Open any app" (Safari / YouTube / Instagram SF Symbols)
   - "Tap Share" (`square.and.arrow.up`)
   - "Choose Pocket Bookmark" (app icon)
   - "Done! Your link is saved."
   Animated sequence with staggered fade-in per step.
3. **Slide 3 — Smart Library** — Collections, tags, AI summaries. Key features highlight with SF Symbol illustrations.
4. **Slide 4 — Daily Digest** — "Listen to your bookmarks." Speaker wave illustration.
5. **Slide 5 — Get Started** — Primary CTA button "Get Started" → dismisses onboarding. Secondary: "You can always find help in Settings."

**Implementation:**
- `@AppStorage("hasCompletedOnboarding") var hasCompletedOnboarding = false`
- Presented as `.fullScreenCover` on `HomeView` when `!hasCompletedOnboarding`.
- "Skip" button top-right on all pages.
- "Get Started" on last page sets `hasCompletedOnboarding = true` and dismisses.
- Respects `accessibilityReduceMotion` — skip slide animations.
- Liquid Glass materials, SF Pro typography, soft spring transitions.
- DEBUG Settings: "Reset Onboarding" clears the `AppStorage` flag.

**Traps:**
- Don't block app launch — onboarding is a cover over a ready-to-use Home.
- Don't show onboarding on every fresh install of a TestFlight update — `@AppStorage` persists across updates.
- Keep copy concise — each slide is ≤ 3 lines of body text.
- No network or AI in onboarding — purely static.
- Page indicator should use `.indexViewStyle(.page(backgroundDisplayMode: .always))` for visibility.

**Done when:** fresh install shows 4–5 page onboarding → Share Sheet tutorial is clear → "Get Started" dismisses → never shows again; DEBUG can reset; existing users see nothing.

**Status:** Done (2026-09-15). `OnboardingView` 5-page Liquid Glass `TabView` (welcome / share steps / library / digest / get started); `AppLogo` hero; staggered share-step reveal; `@AppStorage("hasCompletedOnboarding")` + Home `.fullScreenCover`; DEBUG Settings → Reset Onboarding.

---

## Phase 33: Home Select All ✅

**Objective:** When multi-select is active on Home, offer Select All / Deselect All so bulk archive, delete, pin, and organize don’t require tapping every card.

**Scope:** Home inbox select mode only (not Library browse views).

**Deliverables:** `HomeViewModel.swift`, `HomeView.swift`; optional `BulkSelectAndPinTests` cases

1. **`HomeViewModel`**
   - `selectAll(ids: Set<UUID>)` — replace `selectedIDs` with the given set (caller passes currently displayed IDs).
   - `deselectAll()` — clear `selectedIDs` without exiting select mode.
   - Helper: `allDisplayedSelected(displayedIDs:) -> Bool` for toolbar label toggle.
2. **`HomeView` select-mode toolbar**
   - Leading group already has Done (xmark). Add **Select All** when not every displayed item is selected; swap label to **Deselect All** when they are.
   - Displayed set = whatever the grid is showing right now: search results if searching, else pinned ∪ fresh ∪ aging (respect archive mode). Do **not** select hidden / filtered-out items.
   - Keep existing trailing bulk actions unchanged.
3. **Haptics / a11y** — `.pocketHaptic(.selection)` on toggle; accessibility labels “Select All” / “Deselect All”.

**Traps:**
- Select All must target **visible** items only — never the whole store.
- Do not exit select mode on Deselect All.
- Pinned strip + masonry share the same `selectedIDs`; Select All should include both when both are on screen.
- Search / facet changes while selecting: leave selection as-is (IDs may fall out of view); Select All re-scopes to the new displayed set when tapped again.

**Done when:** enter Select → Select All checks every visible card → Deselect All clears checks → bulk Archive/Delete/Pin/Add to Collection still work; Done still exits select mode.

**Status:** Done (2026-09-15). Inline `SelectModeBanner` (“Select bookmarks” + Select All / Deselect All) on Home inbox **and** Archive; toolbar keeps Done + bulk actions only. Context-menu **Select** enters multi-select (Home + Collection). Collection select mode: Archive / Remove from Collection / Move (`BulkAddToCollectionSheet(removingFrom:)`). `HomeViewModel` select helpers + BulkSelectAndPinTests.

---

## Phase 34: Facet Selection Summary ✅

**Objective:** When filter chips are selected, show a compact summary of what’s active so horizontal scroll can’t hide the user’s choices.

**Deliverables:** `SmartLibraryFilter.swift` (`SearchFacets`), `SearchFacetBar.swift`; used automatically on Home, Collection detail, Media/Tag browse

1. **`SearchFacets`**
   - Add `var summaryLabels: [String]` — ordered short labels for active facets only, e.g. `Unread`, platform `displayName`, `#tag`, `Archived`. Empty when `!isActive`.
   - Optional: `var summaryText: String` — joined with middle dots / commas for VoiceOver.
2. **`SearchFacetBar`**
   - Above (or tightly below) the horizontal chip `ScrollView`, when `facets.isActive`: a single-line caption in `.caption2` / `.secondary`, e.g. `Filtered: Unread · YouTube`.
   - Truncate with tail if many; full string in `.accessibilityLabel` / `.accessibilityValue`.
   - Optional clear affordance: small “Clear” text button at trailing end of the summary row (clears all facets). Nice-to-have; include if it stays one line.
3. **Layout** — summary must not steal vertical space when inactive; no animation thrash on every chip tap beyond existing spring/haptic.

**Traps:**
- Home already hides tag chips (`showsTags: false`) — summary should still show a tag if one were set, but Home won’t set tags via this bar.
- Don’t duplicate the chip row; summary is readout only (except optional Clear).
- Keep Liquid Glass calm — no loud banners or colored pills for the summary itself.

**Done when:** select Unread + a platform, scroll chips sideways → summary still shows both; clear chips → summary disappears; works on Home and Collection detail.

**Status:** Done (2026-09-15). `SearchFacets.summaryLabels` / `summaryText` / `clear()`; `SearchFacetBar` shows `Filtered: …` caption + Clear above chips when active; zero height when inactive; LibrarySearchTests cover summary order + clear.

---

## Phase 35: Collection Detail Chrome (Settings + Add Link) ✅

**Objective:** From a collection shelf, jump to Settings without hunting Home’s More menu, and save a new link straight into that collection.

**Deliverables:** `CollectionDetailView.swift`, `AddLinkSheet.swift` (preselect API); Free-tier collection cap path reused

1. **Settings button (no More menu)**
   - Toolbar `ToolbarItem(placement: .topBarTrailing)` — `gearshape` → `NavigationLink(value: SettingsRoute())` (Home stack already registers `.navigationDestination(for: SettingsRoute.self)`).
   - Visible icon always (bonus requirement). Do **not** bury Settings under `Menu`.
   - Accessibility: “Settings”.
2. **Add Link (+)**
   - Toolbar `plus` opens `AddLinkSheet` with the current collection pre-selected.
   - Extend `AddLinkSheet`: `preselectedCollectionID: UUID? = nil` (or `Set<UUID>`); on appear, insert into `selectedCollectionIDs` (user can still toggle off).
   - After save: refresh membership / cover as existing save path already does; dismiss sheet; optional quiet toast not required if Home’s pattern isn’t local here.
3. **Toolbar layout (avoid crowding)**
   - Trailing order suggestion: **Add Link (+)** · **Add Sub-Collection** (top-level only, existing) · **Settings (gear)**.
   - Sub-collection button stays top-level-only; + and Settings on every collection (parent and child).
4. **Free tier**
   - Saving into a collection counts toward the **50 unique collection-member** cap when the new item would be a first-time member.
   - Reuse `FreeTierPolicy` / unlock sheet: if over cap, either block joining with the same calm unlock copy used in Organize, or save the bookmark **without** collection membership and surface unlock — prefer **block preselected join + unlock** so the user’s intent (“add to this shelf”) stays honest.
   - Inbox soft cap (20) unchanged — saves never fail; enrichment pause rules unchanged.

**Traps:**
- `SettingsRoute` must resolve from the existing Home `NavigationStack` — don’t wrap Collection in a new stack that drops destinations.
- Don’t run enrichment in the sheet; keep `ShareSaveService` path.
- Preselect must survive `AddLinkSheet`’s collection list including sub-collections (indent already exists).
- Empty-shelf CTA can also offer “Save a link” later — out of scope unless trivial.

**Done when:** from any collection, gear opens Settings and back-navigates correctly; + opens Add Link with that shelf checked; save lands the item in the collection (or unlock when over the 50 cap); sub-collection button still works on parents.

**Status:** Done (2026-09-15). Collection toolbar: `+` (Add Link with `preselectedCollectionID`) · Sub-Collection (top-level) · `gearshape` → `SettingsRoute`; over collection cap → unlock instead of sheet; `AddLinkSheet` preselect + FreeTier join gating / cap banner.

---

## Phase 36: Collection Layout Modes (Masonry ↔ List) ✅

**Objective:** Inside a collection, switch between the existing masonry grid and a denser Reddit-style list for faster scanning.

**Deliverables:** `Views/Components/ItemListRow.swift` [NEW]; `CollectionDetailView.swift`; optional tiny `CollectionLayoutStyle` enum (file-local or under `ViewModels/`)

1. **Preference**
   - `@AppStorage("collectionLayoutStyle")` with raw `String` — `masonry` (default) | `list`.
   - Global for all collections (not per-shelf) — simplest, matches Reader settings persistence style. Per-collection later if needed.
2. **Toolbar control**
   - Icon toggle next to collection chrome: `square.grid.2x2` ⇄ `list.bullet` (or segmented control in toolbar if it stays calm).
   - Reflects current mode; one tap switches; haptic `.selection`.
3. **`ItemListRow`**
   - Horizontal row: thumb (~56–72pt, rounded, content aspect cropped) · title (2-line max) · secondary meta (site / platform / date) · optional unread/failed cues.
   - Context menu + accessibility actions parity with `ItemCardView` for this surface (Open, Organize, Remove from Collection, Show More, Edit Thumbnail / Retry when gated, etc.) — wire the same callbacks Collection already passes.
   - No horizontal swipe-to-archive in v1 of list (avoid scroll conflicts); swipes remain masonry accelerators only unless trivially reusable.
4. **`CollectionDetailView` body**
   - Keep `SearchFacetBar` + sub-collection strip above content.
   - `masonry` → existing `MasonryGrid` + `ItemCardView`.
   - `list` → `LazyVStack` of `ItemListRow` (or `List` with plain style + hidden backgrounds so `bgColor` shows through).
   - Zoom / matched transition: list rows should still set `.matchedTransitionSource` when opening reader if practical; degrade gracefully if list thumb can’t morph cleanly.
5. **Empty / search** — unchanged empty states; filtered results honor the active layout.

**Traps:**
- Do **not** change Home layout in this phase — collection only.
- List must honor Dynamic Type and Reduce Transparency (glass/meta, not hard cards).
- Avoid rebuilding a second Organize/unlock pipeline — reuse callbacks.
- Performance: `LazyVStack`/`List`, not an eager `VStack` of all members.
- Free-tier / enrichment pause badges must remain visible on list rows.

**Done when:** user toggles list ↔ masonry in a collection; preference survives relaunch; list shows dense rows with working open/context actions; masonry unchanged as default.

**Status:** Done (2026-09-15). `CollectionLayoutStyle` + `@AppStorage("collectionLayoutStyle")`; toolbar layout toggle; `ItemListRow` (thumb + title + meta, select/context parity, no swipe); `CollectionDetailView` switches `MasonryGrid` ⇄ `LazyVStack`; Home untouched.

---

## Phase 37: Search Quality (Notes + Library Scope + Smarter AI)

**Objective:** Make findability match how people actually remember saves — by private notes, across every shelf from the Collections hub, and with AI smart search that feels snappy when enabled (and still useful when it’s off).

**Why now:** Notes shipped in Phase 13 but never entered the lexical haystack. Library Shelves search only matches shelf *names*, so bookmarks are invisible until you open a shelf. Smart search (`ai.smartSearchEnabled`) awaits a fresh `LanguageModelSession` on every query and averages crude `NLEmbedding` word vectors — slow and often no better than substring.

**Deliverables:** `SearchService.swift`; `EmbeddingIndexer.swift` / ingest embedding text (`IngestionManager`); `NotesEditor.swift` (reindex on save); `LibraryView.swift`; `CollectionDetailView.swift` (verify scope only); `AIEngine.interpretSearch`; `HomeView.runSearch` (debounce / progressive results); tests in `LibrarySearchTests` / `SearchAndColorTests` / optional new `SearchServiceTests`

### A. Lexical — include private notes (and keep Spotlight honest)

**Current gap:** `SearchService.haystack` indexes title, description, tags, collection names, and a 500-char body prefix — **not** `item.notes`. Spotlight already snippets notes.

1. **Haystack** — Append `item.notes` (lowercased, full string; notes are user-scale, not article-length). Same path for `lexicalMatches`, `lexicalScore`, and keyword filter.
2. **Embeddings** — When building `item.embedding` at ingest, include notes + tag names + `cachedSummary` (not only title/description/body). Cap total source text (~1.5–2k chars) so `NLEmbedding` stays cheap.
3. **Notes edits** — On `NotesEditor` autosave, recompute `item.embedding` via `EmbeddingIndexer.vector(for:)` (or a tiny `EmbeddingIndexer.reindex(item:)` helper). Do **not** re-run full enrichment.
4. **Tests** — Lexical hit on notes-only query (title unrelated); `#tag` + notes still work; empty notes unchanged.

**Fallback:** Lexical substring always works with AI off — notes must hit without smart search.

### B. Library hub — search bookmarks across shelves; shelf detail stays scoped

**Current gap:** `LibraryView.filteredCollections` filters `topLevelCollections` by `name` only. Types segment already peeks member content; Shelves does not. `CollectionDetailView` correctly scopes `SearchService.scoped` to that collection’s members — keep that.

1. **Shelves segment + query**
   - Keep a **Shelves** block: name (and optional symbol) matches, as today.
   - Add a **Bookmarks** block below (or above if zero shelf-name hits): active, non-deleted items that belong to **any** collection (parent or sub), matched via `SearchService.lexicalMatches` (same haystack as Home, including notes after A).
   - Each hit row: reuse `ItemListRow` (or a compact Library row) with shelf attribution subtitle (`In {collection name}` — prefer the most recently used / first membership). Tap → existing `ItemRoute` / open path used elsewhere from Library (push reader via Home stack destinations already registered, or navigate into the owning collection then open — prefer **direct open** with `NavigationLink`/`path` if Library sits on Home’s stack; otherwise mirror MediaTypeBrowse’s `onOpenItem` pattern).
   - Cap displayed bookmark hits (~40) with “showing top matches” calm copy if truncated; sort by lexical score then `dateAdded` desc.
2. **Empty states**
   - No shelf-name hits + no bookmark hits → one `ContentUnavailableView` (“No matching shelves or bookmarks”).
   - Shelf hits only / bookmark hits only → hide the empty section.
3. **Prompt copy** — Shelves search prompt: “Find shelves or bookmarks” (not only “Find a shelf”).
4. **Sub-collections** — Membership search includes items on child shelves; do not require opening the parent first.
5. **Shelf detail unchanged** — Inside `CollectionDetailView`, search remains **members of this collection only** (existing `scoped`). No cross-library bleed.
6. **AI on Library hub (optional, same phase if cheap)** — Default **lexical only** on the hub for speed. If smart search is on, optionally run the same progressive AI path as Home **only for the Bookmarks block**, never feed the whole library text to the model — still `SearchFilter` + embeddings over the candidate set.

**Traps:** Don’t `@Query` every item into an eager `VStack`. Lazy list for bookmark hits. Free-tier / archived: use the same “active” definition as Library (`deletedAt == nil`, typically non-archived for hub; archived shelves membership is rare — prefer active inbox items that are shelved).

### C. Smarter + faster AI smart search (when Settings toggle is on)

**Current path (`SearchService.search`):** `interpretSearch` (LLM → `SearchFilter`) → apply filter → cosine-rank vs stored embeddings → else substring. Home calls this on every `onChange` of text/facets with `useAI: true` whenever the query is non-empty. LLM runs even for `"pasta"`.

**Design principles (apple-intelligence rules):** Never dump the library into the prompt; structured `@Generable SearchFilter` only; lexical fallback always; hide/disable nothing when model unavailable — soft-fail to lexical+embeddings.

1. **Debounce** — Home (and any AI-backed surface): ~300–400ms after typing stops before starting AI work. Cancel in-flight `Task` on newer queries (generation token / trimmed-string guard already partially exists — harden it).
2. **Progressive results (feel fast)**
   - **t0:** Show lexical (+ facet) hits immediately.
   - **t1:** If smart search on + model available + query looks “structured,” upgrade list with filter + embedding re-rank when ready; don’t blank the list while waiting.
3. **Skip LLM for simple queries** — Heuristic: if the query has no time/platform/unread/archive cues (e.g. no “last week”, “youtube”, “unread”, “archived”), **skip `interpretSearch`** and do lexical + embedding rank only. Reserve the Foundation Model for phrases that need structure.
4. **Cache** — Memoize `interpretSearch` results keyed by normalized query (and maybe locale) for the session; clear on memory warning / scene background. Avoid new `LanguageModelSession` per identical re-type.
5. **Prompt / schema** — Tighten `interpretSearch` guide: empty keywords when the query is only a platform/tag/time constraint; prefer taxonomy tag names; don’t invent platforms. One neutral retry on guardrail failure (existing AIEngine pattern), then fallback.
6. **Ranking**
   - Blend: lexical (notes-aware) + semantic; require a minimum cosine floor or demote near-zero embeddings so random semantic noise doesn’t outrank exact title/note hits.
   - Prefer title/note/tag hits over body-only hits in `lexicalScore` (weighted fields).
7. **Embedding freshness** — Backfill missing embeddings opportunistically (idle / after search miss) without blocking UI; notes reindex from A.
8. **Settings honesty** — Keep the “can feel slower” toast, but after this phase smart search should feel like an upgrade on complex queries, not a tax on every keystroke.

**Fallback:** Smart search off, model unavailable, or LLM error → facets + notes-aware lexical (+ embeddings if present). Never empty the inbox solely because AI failed.

### Done when

- Searching a unique word that exists **only** in a bookmark’s notes finds that item on Home (AI on or off).
- On Collections → Shelves, a query matching bookmark title/notes/tags surfaces those items even when no shelf name matches; opening a shelf still searches only that shelf’s members.
- With smart search on: short keyword queries return lexical hits without waiting on the LLM; “youtube unread last week”-style queries still produce structured filters; typing doesn’t hitch every character.
- Unit tests cover notes haystack, library cross-shelf lexical helper, and simple-query LLM skip (or interpretSearch not called) where testable.

**Status:** Done (2026-09-16). **A** notes haystack/embeddings · **B** library cross-shelf search · **C** smarter/faster AI: debounce + progressive lexical, `queryNeedsStructure` LLM skip, interpretSearch cache + tighter prompt, weighted lexical + cosine floor, embedding backfill; Settings toast updated.

---

## Phase 38: In-App Web Reader Mode Fallback ✅

**Objective:** Give the user an escape hatch when local Readability extraction fails or is incomplete — open the link in-app in Safari Reader Mode without leaving PocketBookmark.

**Context:** `ReaderView` relies on `IngestionManager` → Readability for offline text. Edge cases (paywalled pages, JS-rendered SPAs, incomplete HTML) produce empty or broken `textContent`. Currently the only alternative is "Open in Safari" which ejects the user out of the app.

**Approach:** Present an `SFSafariViewController` configured with `entersReaderIfAvailable = true` from inside `ReaderView`. The user stays in-app; Safari's own Reader distills the content. This is **not** a replacement for local extraction — it's a fallback.

**Deliverables:** `Managers/SafariReaderPresenter.swift` [NEW]; `ReaderView.swift` update; `HomeView.swift` (routing awareness)

1. **`SafariReaderPresenter`** — thin `UIViewControllerRepresentable` wrapper around `SFSafariViewController`.
   - `import SafariServices`.
   - Configure: `let config = SFSafariViewController.Configuration(); config.entersReaderIfAvailable = true`.
   - `preferredControlTintColor` = content tint from item's dominant color.
   - Present as `.sheet` (not `.fullScreenCover`) so the user can dismiss back to the reader easily.
2. **`ReaderView` toolbar — More (…) menu**
   - Add **"Open in Reader Mode"** action (`safari` SF Symbol) in the More menu, between "Reader Settings" and the Share link.
   - Always visible when `item.url` is valid `http(s)` — don't gate behind enrichment status. This is most useful when enrichment *failed*.
   - Also add **"Open in Safari"** (`arrow.up.right.square`) in the same menu — just a `UIApplication.shared.open(url)` call. This replaces (or supplements) the social-media "Open in \(platform)" link at the bottom for articles; social items keep their existing `MediaHeroView` link.
3. **Article empty state** — When `textContent` is nil/empty for articles (`.article` / `.other`), the existing copy reads "No offline text yet for this bookmark. You can open the original link instead." **Add** an inline "Open in Reader Mode" button below that message, styled like the existing "Retry metadata" capsule button. This gives an obvious one-tap fallback right where the user is stuck.
4. **Accessibility** — label "Open in Reader Mode"; hint "Opens this link inside the app in a distilled reading view."

**Traps:**
- `SFSafariViewController` must be presented from a UIKit host — use `UIViewControllerRepresentable` not a `WKWebView`.
- Do **not** try to extract text from `SFSafariViewController` back into the model — it's read-only.
- Safari Reader availability is not guaranteed (some pages won't enter Reader); the user simply sees the normal web page — still better than leaving the app.
- Don't remove the existing `MediaHeroView` external open for YouTube/TikTok — those are not readable in Safari Reader.
- `SFSafariViewController` inherits the app's tint, not the reader theme. That's fine — don't try to force Sepia/Paper/Black on it.

**Done when:** from any bookmark's reader, the user can tap More → "Open in Reader Mode" → `SFSafariViewController` appears as a sheet → Safari Reader distills the content → dismiss returns to PocketBookmark reader. Empty-state articles show a prominent inline button.

**Status:** Done (2026-09-16). `SafariReaderPresenter` (`entersReaderIfAvailable`); Reader More menu: Settings → Reader Mode → Open in Safari → Share; article empty state capsule button; sheet on `ReaderView` (Home `ItemRoute` unchanged).

---

## Phase 39: Universal Reader Hero Images ✅

**Objective:** Display hero thumbnail images for **all** bookmark types (articles, blogs, general links) at the top of `ReaderView`, not just media items. Whenever `Item.thumbnailData` is available, show it.

**Context:** Currently only media platforms (YouTube, TikTok, Instagram, X) render a `MediaHeroView` poster. Articles and `.other` links show no visual at the top even when they have a perfectly good enrichment thumbnail sitting in `thumbnailData`.

**Deliverables:** `Views/Components/ReaderHeroImage.swift` [NEW]; `ReaderView.swift` update

1. **`ReaderHeroImage`** — a reusable view builder for the article hero thumbnail.
   - Input: `thumbnailData: Data?`, `dominantColor: (R, G, B)`, `theme: ReaderTheme`.
   - Full-width image at the top of the scroll, height proportional to aspect ratio (cap at 280pt, same as `MediaHeroView` default).
   - **Bottom gradient mask** — a `LinearGradient` from `clear` to `theme.background` (the active reader theme color: Sepia, Paper, Black, or System) so the image blends seamlessly into the text below. The gradient covers the bottom ~30% of the image.
   - `scaledToFill` + clip with `RoundedRectangle(cornerRadius: 0)` — full bleed, no rounded corners at top so it feels like a hero, not a card.
   - Optional subtle parallax on scroll (if `!reduceMotion`) — offset the image `y` by a fraction of scroll position for depth. Can skip if complexity is disproportionate.
   - Graceful absence: if `thumbnailData` is nil or invalid, the view returns `EmptyView` — no placeholder.
2. **`ReaderView` scroll hierarchy**
   - For non-media items (`!isMedia && !usesSocialCaption`): insert `ReaderHeroImage` **above** `header` in the VStack.
   - For `usesSocialCaption` (Reddit): also show `ReaderHeroImage` above `header` when thumbnail exists — Reddit often has preview images.
   - Media items (YouTube/TikTok/Instagram/X) keep `MediaHeroView` as-is — don't double up.
   - The hero image sits outside `padding(.horizontal, settings.margin)` — it bleeds to the screen edges for impact, while the text below remains padded.
3. **Theme blending** — the gradient bottom color must reactive-bind to `settings.theme.background` so it updates live when the user switches themes in the Reader Settings sheet.
4. **Accessibility** — `accessibilityHidden(true)` on the hero image (it's decorative; the content is described by the title/description below).

**Traps:**
- The gradient mask color **must** match `settings.theme.background` exactly — use the computed `Color`, not a hardcoded opacity.
- Don't show a hero for items where `thumbnailData` is non-nil but tiny/corrupt — guard with `UIImage(data:)` returning non-nil.
- Full-bleed layout: the hero sits in a separate container *outside* the horizontal padding. Use negative horizontal padding or restructure the VStack with two levels (full-bleed + padded).
- Don't break the existing `MediaHeroView` for video/social — media items must not show both heroes.
- Scroll progress tracking (`onScrollGeometryChange`) must still work correctly with the hero added.

**Done when:** opening an article with a thumbnail shows a full-width hero image at the top of the reader → the image fades into the active theme via gradient → switching theme updates the gradient live → items without thumbnails show nothing → media items still use `MediaHeroView`.

**Status:** Done (2026-09-16). `ReaderHeroImage` full-bleed + theme gradient (~30%); wired above padded content for all `!isMedia` (articles + Reddit); `MediaHeroView` unchanged; no parallax (skipped); invalid thumbs → empty.

---

## Phase 40: First-Class Standalone Notes (Text + Images)

**Objective:** Introduce Notes as a standalone first-class item type in the library — not just metadata on bookmarks. Users can create text notes with optional image attachments directly from the Home toolbar.

**Why:** Currently the only way to add content is via URL (link bookmark). Users want to capture thoughts, highlights, and ideas without having a URL. Notes live alongside bookmarks in the same inbox, collections, and search infrastructure.

### A. Model Updates ✅ (2026-09-16)

#### [MODIFY] [`SourcePlatform.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/Shared/Models/SourcePlatform.swift)
- Add `case note` to `SourcePlatform`.
- `displayName` → `String(localized: "Note")`.
- CloudKit-safe: additive enum case, raw string storage unchanged.

#### [NEW] [`ItemAttachment.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/Shared/Models/ItemAttachment.swift)
```swift
@Model
final class ItemAttachment {
    var id: UUID = UUID()
    var sortIndex: Int = 0
    @Attribute(.externalStorage) var imageData: Data?
    var item: Item?
    var dateAdded: Date = Date()

    init(imageData: Data, sortIndex: Int = 0) {
        self.id = UUID()
        self.imageData = imageData
        self.sortIndex = sortIndex
        self.dateAdded = Date()
    }
}
```
- `@Attribute(.externalStorage)` on `imageData` is **critical** — CloudKit syncs it as an asset, not inline in SQLite.
- Relationship inverse on `Item.attachments`.

#### [MODIFY] [`Item.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/Shared/Models/Item.swift)
- Add `@Relationship(inverse: \ItemAttachment.item) var attachments: [ItemAttachment]?`.
- Add computed `var isNote: Bool { sourcePlatform == .note }`.
- Notes use `url` = `"note://<uuid>"` (synthetic URI so the non-empty `url` constraint and existing predicates don't break). Not a real URL — never open externally.
- Notes use `textContent` for the prose body (already `@Attribute(.externalStorage)`).
- `title` = first line of text or "Untitled Note".
- `status` = `.ready` immediately (no enrichment needed).

#### [MODIFY] [`DatabaseManager.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/Shared/DatabaseManager.swift)
- Add `ItemAttachment.self` to the `Schema` array in both `makeContainer` and `makeCloudKitContainer`.

**A status:** Done — `SourcePlatform.note`, `ItemAttachment` (+ cascade), `Item.isNote` / `noteURL` / `noteTitle`, schema updated; exhaustive switches patched for compile; round-trip test added. `.note` temporarily maps to Library `.other` until Part D.

### B. Note Creation UI ✅ (2026-09-16)

#### [MODIFY] [`HomeView.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Views/HomeView.swift)
- Change the `+` button from directly opening `AddLinkSheet` to presenting a **`Menu`** with two options:
  - **"Add Link"** (`link` SF Symbol) → existing `showAddLink = true` flow.
  - **"Add Note"** (`note.text` SF Symbol) → new `showAddNote = true`.
- Add `@State private var showAddNote = false` and present `NoteEditorView` as a sheet.
- The existing clipboard offer / deep link paste flows continue to trigger `AddLinkSheet` directly (no menu for those programmatic paths).

#### [NEW] [`NoteEditorView.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Views/Notes/NoteEditorView.swift)
- Presented as a `.sheet` for new notes; also reused as a push destination for editing existing notes from the reader.
- Layout:
  - Navigation title: "New Note" (create) or the note title (edit).
  - **TextEditor** (native SwiftUI) — full width, uses reader font settings for consistency. Saves to `item.textContent`.
  - Below the editor: **horizontal image gallery** — `ScrollView(.horizontal)` of attached images with an "Add Image" button (`PhotosPicker` from `PhotosUI`).
  - Each attached image: ~80pt square thumbnail, tap to preview full-size (sheet), long-press to delete.
  - Images compressed via `ThumbnailService.downscale(_:maxPixelSize:)` at 1200px (slightly larger than bookmark thumbs — note images are primary content, not decoration).
- **Auto-title:** On save, derive `item.title` from the first line of text (first 80 chars, trimmed). Fall back to "Untitled Note".
- **Save semantics:**
  - **New note:** Create a new `Item` with `sourcePlatform: .note`, `status: .ready`, `url: "note://<uuid>"`, insert into `modelContext`.
  - **Edit:** Mutate existing item. Auto-save with debounce (same pattern as `NotesEditor`).
  - Compute `item.embedding` via `EmbeddingIndexer` on save (notes are searchable).
  - Index in Spotlight via `SpotlightIndexer.index(item)`.
  - No enrichment pipeline — `.note` items bypass `IngestionManager` entirely.
- Toolbar: Done (save + dismiss); Cancel (discard if new, revert if edit — confirm if dirty).

**B status:** Done — Home `+` Menu (Add Link / Add Note); `NoteEditorView` create+edit (TextEditor, ≤5 images @1200px, debounce autosave on edit, discard/revert confirm); embedding + Spotlight + widget reload; first image → card thumb/color.

### C. Note Reader Experience ✅ (2026-09-16)

#### [MODIFY] [`ReaderView.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Views/ReaderView.swift)
- When `item.isNote`:
  - No `MediaHeroView`, no `ReaderHeroImage` (Phase 39) unless the note has attachments with images — in that case show a hero from the first attachment.
  - Header shows note title (first-line-derived) + "Note" label + date.
  - Body shows full `textContent` (no summary/expand logic — notes are always shown fully).
  - Below body: image attachment gallery (horizontal scroll, tappable to full-screen preview).
  - No "Open in Reader Mode" (Phase 38) — notes have no external URL.
  - No Extract Core Info — notes are user-written, not fetched articles.
  - Listen (TTS) still works if the text is long enough — reuse existing `ReaderSpeechController` on `textContent`.
  - Tags/Collections section still shows at the bottom. Private `NotesEditor` is hidden for standalone notes (the note body is the content).
  - Bottom bar: keep Archive, Organize, but hide "Open Link" (there is none).
- Edit action: toolbar button **"Edit Note"** (`pencil`) → pushes `NoteEditorView` in edit mode.

**C status:** Done — note path in Reader (hero from first attachment, full body, photo gallery, Edit Note push, no Reader Mode / Extract / Open); `NoteEditorView(embedsNavigationStack: false)` for push.

### D. Library & Search Integration ✅ (2026-09-16)

#### [MODIFY] [`SmartLibraryFilter.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Models/SmartLibraryFilter.swift)
- Add `case notes` to `MediaLibraryType` — title "Notes", symbol `note.text`, empty state "No notes yet" / "Create a note from the + button on Home."
- `type(for item:)` → `.note` source platform maps to `.notes` library type.

#### [MODIFY] [`SearchService.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Services/SearchService.swift)
- Notes are already searchable via `textContent` + notes haystack (Phase 37). Verify `.note` items appear in lexical and embedding searches.

#### [MODIFY] [`ItemCardView.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Views/Components/ItemCardView.swift) / [`ItemListRow.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Views/Components/ItemListRow.swift)
- Note cards show `note.text` icon badge instead of platform favicon.
- Thumbnail: first attachment image (if any), else dominant-color gradient (reuse existing fallback).
- No "Retry Enrichment" in context menu for notes.
- Add "Edit Note" in context menu for `.note` items.

**D status:** Done — `MediaLibraryType.notes`; card/row `note.text` badge + attachment thumb; Edit Note sheet wiring; no Retry/Edit Thumbnail for notes; lexical search test for standalone note body.

### E. Ingestion & Enrichment Guards ✅ (2026-09-16)

#### [MODIFY] [`IngestionManager.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark/PocketBookmark/Managers/IngestionManager.swift)
- `pendingWorkItems` filter: skip items where `sourcePlatformRaw == "note"`. Notes never enter the enrichment pipeline.
- `retry(itemID:)`: return early for `.note` items.

#### [MODIFY] [`InboxSyncCoordinator.swift`](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor AI/PocketBookmark/PocketBookmark/Managers/InboxSyncCoordinator.swift)
- `enrichableIDs`: exclude `.note` items from the count (they don't consume enrichment slots or count toward the 20 free cap).

**Traps:**
- `url` must not be empty — use `"note://<uuid>"` synthetic URI. Never try to open it externally.
- `ItemAttachment.imageData` **must** use `@Attribute(.externalStorage)` — without it, large blobs inline in SQLite break CloudKit sync.
- Adding `ItemAttachment` to the `Schema` is mandatory or `ModelContainer` crashes.
- Notes bypass the entire `IngestionManager` pipeline. Don't mark them `.pending` — use `.ready` from creation.
- The 20 free active item cap includes notes (they're `Item` instances). Notes count toward `activeItemCount`. The 50 collection member cap also includes notes.
- Don't break `#Predicate` filters that match on `sourcePlatformRaw` — the new `"note"` raw value must be handled (or excluded) in existing predicates where appropriate.
- `TextEditor` in SwiftUI doesn't support rich text — plain text only. This is intentional for v1.
- Image attachment max count: suggest 5 per note to keep storage sane. Enforce in UI, not model.

**Done when:**
- User taps + → Add Note → editor appears → types text + attaches 2 images → saves → note appears in Home inbox with `note.text` badge.
- Opening the note shows full text + image gallery in reader.
- Library Types → Notes smart filter shows all notes.
- Search finds notes by their text content.
- Notes are not enriched; `.note` items don't consume free-tier enrichment slots.
- Editing an existing note works from reader toolbar.

**E status:** Done — pending/retry/thumbnail skip notes; `enrichableIDs` omits notes (slots); UI pause lists aligned; notes still count in `activeItemCount` unlock banner.

---

## Phase 40 — Complete ✅ (2026-09-16)

A model · B creation UI · C reader · D library/search · E enrichment guards.

## Phase 41: Text Ingestion via Share Extension ✅ (2026-09-16)

**Objective:** Accept plain text shared from other apps (Apple Notes, Keep, Safari text selections) and ingest it as a standalone `.note` item, bypassing the network enrichment pipeline.

**Context:** The Share Extension already accepts `public.plain-text` (line 17–18 in `Info.plist`: `NSExtensionActivationSupportsText = true`). However, when plain text arrives without a URL, `extractPayload()` throws `ShareExtractionError.noURL` and the save fails. This phase makes URL-less text shares work.

**Depends on:** Phase 40 (`.note` source platform + `ItemAttachment` model must exist).

**Deliverables:** `ShareViewController.swift` update; `ShareSaveService.swift` update (new text-save path); `SaveConfirmationView.swift` copy update

1. **`ShareViewController.extractPayload()`** ✅
   - After the existing URL resolution (`guard let resolved else { throw ...noURL }`), **don't throw immediately**.
   - Instead, check if we captured meaningful plain text (`title` is non-empty and looks like prose, not a bare URL). If so, return a new **`ShareTextPayload`** (or extend `SharePayload` with an optional `plainText: String?` field and nil `url`).
   - Heuristic for "text not URL": `URLNormalizer.firstURL(in: text) == nil && text.count >= 5`. Short snippets below 5 chars are probably noise.
   
2. **`SharePayload` extension** ✅
   - `ShareExtractionResult` = `.link(SharePayload)` | `.text(body:)` — link path unchanged.

3. **`ShareSaveService` — new text-save path** ✅
   - `static func saveNote(_ text: String, title: String?) -> ShareSaveOutcome`.
   - Create `Item` with:
     - `sourcePlatform: .note`, `status: .ready`
     - `url: "note://<uuid>"` (synthetic)
     - `title`: first line of `text` (max 80 chars) or `title` parameter
     - `textContent: text`
     - No enrichment, no thumbnail, no tags
   - Insert into the App Group `ModelContext` (same `DatabaseManager.makeContainer()` path).
   - `CrossProcessNotifier.post()` to wake the main app.
   - Return `.savedNote(title:)`.
   - Deduplication: skip if an identical `textContent` + `sourcePlatformRaw == "note"` exists within the last 60 seconds (prevents double-taps).
   - Cap body at 50,000 chars; fallback queue stores `textContent` for notes.

4. **`ShareViewController.runSaveFlow()`** ✅
   - Branch: text payload → `saveNote`; confirmation “Note saved” + `note.text` icon.

5. **`SaveConfirmationView`** ✅
   - `SuccessKind.note` → `note.text` icon.

6. **Main app wake** ✅ — notes are `.ready` and skip enrichment; appear after Darwin refresh.

**Traps:** (honored — text-with-URL still links; no plist change; extension stays offline)

**Done when:** (device verify: Share text → Note saved → inbox `.note`)

**Status:** Done — `ShareExtractionResult`, `saveNote`, confirmation variant, tests, fallback `textContent`.

---

## Phase 42: Note Markup — Links, Checkboxes & Lightweight Formatting

**Objective:** Level up standalone notes beyond plain `TextEditor` with (1) auto-detected clickable URLs, (2) interactive checklists, and (3) a small set of text styles — without hurting inbox scroll, search, TTS, Share Extension, or CloudKit readiness.

**Why now:** Phase 40 intentionally shipped plain text (`TextEditor` has no rich text). Users now want checklists and readable links inside notes. This phase adds that capability without a second storage format.

### Decision: Markdown-lite in `textContent` (not rich-text blobs)

| Approach | Verdict |
|---|---|
| **A. Markdown-lite string in existing `Item.textContent`** | **Chosen.** Same field, CloudKit-safe, searchable, Share Extension–compatible, no schema migration. |
| B. `NSAttributedString` / RTF `Data` field | Rejected. Dual storage, breaks lexical search & embeddings unless we keep a parallel plain string, heavier CloudKit assets, forces `UITextView` everywhere. |
| C. Full WYSIWYG `UITextView` attributed editor | Rejected for v1 of this phase. High complexity, keyboard/IME edge cases, easy to regress performance and accessibility. Revisit only if Markdown-lite feels too “source-y.” |

**Format subset (closed — do not grow without a new phase):**

| Feature | Storage | Edit | Read |
|---|---|---|---|
| Plain paragraphs | as typed | `TextEditor` | rendered |
| **Bold** / *italic* | `**bold**` / `*italic*` | toolbar wraps selection | rendered |
| Headings | `# ` / `## ` line prefix | toolbar | larger weight |
| Bullets | `- ` line prefix | toolbar | indented bullet |
| Checkboxes | `- [ ] ` / `- [x] ` | toolbar inserts; tap toggles in **Reader** | interactive row |
| Links | raw `https://…` (and optional `[label](url)`) | typed or pasted | tappable → Safari / openURL |

**Explicit non-goals (this phase):** tables, nested lists, images-inline-in-prose (attachments stay as today), code blocks, fonts/colors, collaborative sync of caret, AI rewriting of notes.

### Performance & compatibility rules (non-negotiable)

1. **Never parse markup in the masonry / list path.** `ItemCardView` / `ItemListRow` / widget snapshots keep using stripped plain text (first line / peek). Parsing only happens in `ReaderView` note body and optionally a live editor preview.
2. **Single source of truth:** `textContent` remains a `String` (`@Attribute(.externalStorage)`). No new model properties.
3. **Strip for machine consumers:** title derivation, Spotlight, embeddings, lexical search, Digest/TTS, Copy Text, and card peeks all go through `NoteMarkup.plainText(_:)` (strip markers, keep checkbox label text, keep URL strings).
4. **Parse cost:** one linear pass (or `AttributedString` Markdown + `NSDataDetector` for bare URLs), debounced in the editor (≥300 ms). Cap remains Phase 41’s **50,000** characters — refuse to grow.
5. **Checkbox toggle is surgical:** find the tapped line → flip `[ ]` ↔ `[x]` in the string → save. Do **not** rebuild the whole document AST to toggle one box.
6. **Share Extension stays offline & dumb:** `saveNote` keeps writing raw text. If the shared text already contains `- [ ]`, it just works after open; no parsing in the extension.
7. **Existing plain notes** remain valid forever (zero migration). Markup is additive.

### A. Markup helpers & plain-text strip ✅ (2026-09-16)

**Deliverables:** `Shared/NoteMarkup.swift` (or `PocketBookmark/Managers/NoteMarkup.swift` if Shared size is a concern — prefer Shared so tests + widget title peeks can reuse), unit tests.

1. **`NoteMarkup` API (sketch):** ✅
   - `plainText(_ source: String) -> String` — strip `**`/`*`/`#` prefixes/`- [x]`/`- [ ]` markers; keep human-readable words and raw URLs.
   - `toggleCheckbox(in:atLine:) -> String?` — returns mutated source or nil if line isn’t a checkbox.
   - `insertCheckbox(into:at:)`, `wrapBold`, `wrapItalic`, `prefixHeading`, `prefixBullet` — editor toolbar helpers (pure string ops on UTF-16/`String.Index` carefully).
   - Optional: `isCheckboxLine`, `checkboxIsDone` for rendering.
2. **Wire strip into:** ✅
   - `Item.noteTitle(from:)` — title from plain first line (so `# Shopping` → “Shopping”, not “# Shopping”).
   - `EmbeddingIndexer` / save paths for notes — embed `plainText`.
   - `SpotlightIndexer` — title/content description from plain.
   - `ReaderSpeechController` / Copy note — speak/copy plain (or keep raw if user expects markdown — **prefer plain** for speech; Copy can offer raw in a later polish; default Copy = plain with URLs preserved).
   - Also: `SearchService` haystack/lexical body + `ItemCardView` note peek use strip (lightweight; not full reader parse).
3. **Tests:** ✅ `NoteMarkupTests` + `ReaderSpeechTests.testNoteSpeechUsesStrippedMarkup` — strip, toggle, wrap, heading/bullet, Unicode, 50k, fail-soft unbalanced.

**A status:** Done — `Shared/NoteMarkup.swift`; wired into noteTitle · embeddings · Spotlight · search · TTS · Copy · card peek; tests green.

### B. Clickable URLs in the Reader ✅ (2026-09-16)

**Objective:** Any note that mentions a URL becomes tappable in the reader — works for today’s plain notes with zero user education.

**Deliverables:** note body renderer in `ReaderView` (extract a small `NoteBodyView` if `ReaderView` is already too large).

1. Replace paragraph-only `noteBodyContent` with a **block renderer** that: ✅
   - Splits on newlines into blocks (paragraph / heading / bullet / checkbox / empty) via `NoteMarkup.blocks(from:)`.
   - For text runs: `NoteMarkup.linkifiedAttributedString` — markdown `[label](url)` + **`NSDataDetector` `.link` only** for bare URLs; unwraps `**`/`*` for display (weight/style in 42D).
2. Tap → `OpenURLAction` `.systemAction` for `http`/`https` only (`isOpenableHTTPURL`). Ignore `note://` and other schemes. ✅
3. Keep `.textSelection(.enabled)`; checkboxes are **display-only** until 42C (square SF Symbol + strikethrough when done). ✅
4. **Do not** auto-link inside the live `TextEditor` — editor unchanged. ✅

**B status:** Done — `NoteBodyView` wired from `ReaderView.noteBodyContent`; `NoteMarkup.Block` + `linkifiedAttributedString`; tests for blocks, bare URLs, markdown links, scheme filter.

### C. Interactive checkboxes ✅ (2026-09-16)

**Deliverables:** checkbox block UI; toolbar insert; reader toggle → persist.

1. **Storage:** lines matching `^\s*- \[([ xX])\]\s+(.*)$` (tolerate one space variants). ✅ via `NoteMarkup`
2. **Reader:** each checkbox is an `HStack` — tappable square SF Symbol + linkified label (`NoteBodyView.onToggleCheckbox`). ✅
3. **Toggle:** `NoteMarkup.toggleCheckbox` → write `item.textContent` + refresh title → save; Spotlight/embedding/widget coalesced ~1s (`scheduleNoteIndexRefresh` / flush on disappear). ✅
4. **Editor toolbar:** `NoteEditorView` Checklist capsule inserts a new `- [ ] ` line (caret bridge deferred to 42D). ✅
5. **Accessibility:** combined label + completed/not value + toggle action; VoiceOver hint. ✅

**C status:** Done — reader toggle persists; Checklist insert in editor; debounce index refresh; round-trip test.

### D. Formatting toolbar + rendered styles ✅ (2026-09-16)

**Deliverables:** editor formatting bar; reader styles for bold/italic/heading/bullet.

1. **`NoteEditorView`:** formatting strip above image gallery (`.ultraThinMaterial`): ✅
   - Bold · Italic · Heading · Bullet · Checklist · Link (when selection is http(s) URL)
   - `NoteTextSelectionBridge` — UITextView KVO for `selectedRange`; apply selection after marker inserts
2. **Reader rendering:** ✅
   - `# ` / `## ` → larger semibold fonts from `ReaderSettings`
   - `**` / `*` → `InlinePresentationIntent` stronglyEmphasized / emphasized in `linkifiedAttributedString`
   - `- ` (non-checkbox) → bullet row
3. **Malformed markup:** fail soft — unbalanced markers kept literally. ✅

**D status:** Done — formatting strip + selection bridge; styled attributed runs; heading/bullet/checkbox unchanged; tests for wrap/link/intents.

### E. Polish, guards & verification ✅ (2026-09-16)

1. Card / list / widget peeks use `NoteMarkup.plainText` / `Item.noteTitle` — no `#` / `- [ ]` in peeks. ✅
   - `ItemCardView` strip · `ExpandedCardOverlay` note body peek · widget title via `noteTitle` · Library suggest excerpt strip
2. Share Extension text notes with pasted Markdown — stored raw; title stripped; reader linkifies. ✅ (`testSaveNotePreservesMarkdownLiteBodyAndStripsTitle`)
3. 20-active / 50-collection caps and ingestion skips unchanged — notes count toward active cap; still omitted from enrichment. ✅ (`testNotesCountTowardActiveItemCap`)
4. Localization: formatting / checkbox a11y strings in `Localizable.xcstrings`. ✅
5. Unit tests + device smoke path documented below. ✅

**Device smoke (manual):**
1. Home `+` → Add Note → Bold a word, Heading, Bullet, Checklist → Done.
2. Open note → styles + tappable URL + toggle checkbox → leave → reopen (state persists).
3. Share plain Markdown text from Notes → “Note saved” → inbox title is plain; body still has markers in editor.
4. Scroll Home with mixed notes/bookmarks — no hitch (cards only call `plainText`, never `blocks` / detector).

**E status:** Done — peeks/widget/library/share/caps verified; strings cataloged; tests green.

### Traps (honored)

- **Do not** introduce `textContentFormat` / RTF fields — YAGNI and CloudKit pain.
- **Do not** parse Markdown inside `ItemCardView` or `MasonryGrid` (strip only).
- SwiftUI `TextEditor` shows raw markers while editing — intentional.
- `NSDataDetector` restricted to `.link` only; `http`/`https` open only.
- Checkbox toggle equality-guarded; Spotlight/embedding coalesced ~1s.
- Image attachments stay as Phase 40 gallery — no inline `![alt](x)`.
- Phase 13 bookmark-private `notes` field is out of scope.

---

## Phase 42 — Complete ✅ (2026-09-16)

A helpers · B links · C checkboxes · D formatting · E polish.

### Definition of done (phase)

- [x] Links in note bodies are tappable (bare URL + optional markdown link).
- [x] User can insert and toggle checkboxes; state persists in `textContent`.
- [x] Bold / italic / heading / bullet render in Reader; toolbar inserts markers in editor.
- [x] Search, title, TTS, Spotlight, embeddings, cards use stripped plain text.
- [x] No schema migration; Share Extension save path unchanged.
- [x] Home masonry performance unchanged (no per-card parse).

**Status:** Phase 42 complete.

---

## Phase 43: Modern Note Formatting (WYSIWYG Bold/Italic) ✅ (2026-09-16)

**Objective:** Replace Phase 42’s visible markdown-marker editor UX with a WYSIWYG rich-text surface that still stores markdown-lite in `Item.textContent`. Quiet Bold/Italic toggles only — no Heading/Bullet/Checklist chips.

**Why now:** Phase 42D’s Bold/Italic/Heading/Bullet/Checklist strip inserted raw markers into SwiftUI `TextEditor`, which felt dated. Storage and reader paths were already solid; only the edit surface needed modernization.

### Decision: WYSIWYG over markdown-lite (Option A)

| Approach | Verdict |
|---|---|
| **A. `UITextView` WYSIWYG Bold/Italic; remove line-rewrite chips** | **Chosen.** Markers hidden while editing; storage unchanged; reader checkboxes stay. |
| B. Same as A + Return-to-continue list/checklist | Deferred (Phase 43b if wanted). |
| C. Rip formatting strip; plain `TextEditor` again | Rejected — keeps the 90s feel without the styles. |

**Explicit non-goals:** RTF / `NSAttributedString` blob field; Notion-style blocks; showing raw markdown while editing; new schema properties.

### Deliverables

1. **`Shared/NoteRichTextCodec.swift`** — `attributedString(from:baseFont:textColor:)` ↔ `markdown(from:)`; bold/italic as font traits; headings/bullets/checkboxes round-trip for existing Phase 42 notes; bare URLs stay bare when label equals URL (so `NoteMarkup.plainText` peeks stay stable).
2. **`NoteRichTextEditor`** (`UIViewRepresentable` `UITextView`) — selection trait bindings; Bold/Italic commands; typing attributes follow caret; reader fonts/theme.
3. **`NoteEditorView` slimmed** — drop Heading/Bullet/Checklist/Link chips and `NoteTextSelectionBridge`; formatting strip = Bold · Italic toggles only (state reflects selection).
4. **`NoteBodyView` unchanged** — read path still markdown-lite → styled blocks + interactive checkboxes.
5. **Tests:** `NoteRichTextCodecTests` — empty / plain / bold+italic / heading+bullet+checkbox round-trips; legacy markup → encode → `plainText` unchanged.

### Traps (honored)

- Storage remains `String` in `textContent` — search / TTS / Share / embeddings / CloudKit paths keep using `NoteMarkup.plainText`.
- Do not parse markup on the masonry path.
- Existing notes open without migration; save re-serializes cleanly.
- Share Extension still writes raw text offline.

### Device smoke (manual)

1. Open an old note with `#` / `- [ ]` / `**bold**` → editor shows styled text (no markers) → Done → reader still correct.
2. Select a word → Bold / Italic toggles light → leave and reopen.
3. Toggle a checkbox in the reader → state persists (editor not required).

**Status:** Phase 43 complete — Option A. Stabilized 2026-09-16 (reload-while-editing removed; heading≠`**`; exact list round-trip tests).

---

## Sequencing Notes

- Phases 0–4 are the critical path to something usable. Get here first, live with it for a few days, and let real usage reorder the rest.
- Phase 5 (AI) and Phase 6 (audio) are independent of each other and can swap order based on what's more fun to build.
- Phase 7 (system integration) is the highest value-per-hour in the whole plan. Don't let it slip to the end just because it's listed late.
- **Phase 9 (Collections) before Phase 10 (paste)** — organize existing saves first; paste increases intake volume and needs shelves to land in.
- Phase 10 is small and can slip ahead of Collections if paste friction is blocking daily use.
- Resist adding features before Phase 11. Polish is what separates this from the dozen abandoned read-later apps.
- **After Phase 11:** prefer **12 → 13 → 14 → 15**. Metadata/copy/share (12) is quick and improves the reader chrome; notes (13) need a model field; in-reader audio (14) leans on cached summaries + speech from Phase 6; localization (15) last so we don't re-catalog strings twice while copy is still moving.
- Phase 15 can start earlier as a mechanical pass in parallel with 12–13 if multiple agents work — but freeze user-facing copy before adding real locales.
- **Phase 16** — AI quality before more AI features. Bad summaries destroy trust faster than missing features. **Done.**
- **Phase 11 device/TestFlight** can proceed in parallel with coding phases; don't block 17+ on App Store screenshots.
- **Post-16 coding order (as shipped through 27):** **17 → 18 → 19 → 20 → 21 → 22 → 23 (IAP, 20 free) → 25 (one-shot library suggest) → 27 (TipKit) → 26 (Settings finish)**. Treat **24 (CloudKit)** per current HANDOFF (held). **Remaining:** Phase 11 device/TestFlight manual; Phase 24 only if asked.
- Pasteboard first: daily annoyance, tiny surface area.
- IAP before CloudKit so free-tier count and unlock restore are defined before multi-device libraries.
- **Phase 27 TipKit** shipped ahead of 26 for discoverability.
- **Post-27 coding order: 28 → 29 → 30 → 31 → 32.** Phase 28 and 30 both touch `ItemCardView` — sequence them. Phase 29 modifies the `BookmarkCollection` model (additive migration). Phase 31 depends on collection model from 29. Phase 32 (onboarding) is independent and cleanest last.
- **Phase 28–32** Done. **Phase 33–36** Done.
- **Post-32 coding order: 33 → 34 → 35 → 36.** Select All (Home only) first; Facet Summary next (shared `SearchFacetBar`, used by Home + collection/browse); Collection Chrome (Settings + Add Link) before Layout Modes so the collection toolbar is settled before the body layout rewrite.
- **Phase 37 Search Quality** Done (A notes · B library hub · C smarter AI).
- **Post-37 coding order: 38 → 39 → 40 → 41.** Phase 38 (Web Reader Fallback) is self-contained and tiny — one new `SFSafariViewController` wrapper. Phase 39 (Reader Hero Images) is also self-contained in `ReaderView` — ship both reader improvements first. Phase 40 (Standalone Notes) is the largest — new model (`ItemAttachment`), new source platform, new editor, new library type, guards across ingestion. Phase 41 (Text Ingestion) depends on Phase 40's `.note` model and `ShareSaveService.saveNote` path — must come last.
- **Post-41 coding order: 42 (A→E).** Done 2026-09-16. Note markup builds on Phase 40/41 plain `textContent` — no schema change.
- **Phase 43** Done 2026-09-16 — WYSIWYG Bold/Italic over the same markdown-lite storage (Option A). Optional 43b (Return-to-continue lists) only if asked.
- Do not insert open-ended AI chat or PDF ingest ahead of remaining work.
- **Phase 11 device/TestFlight** remains manual in parallel; **Phase 24 CloudKit** held unless asked.
