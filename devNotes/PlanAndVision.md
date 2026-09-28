# PocketBookmark — Design Bible & Feature Specification

**One-line pitch:** Save anything from anywhere in under a second, and never feel guilty about the pile again.

**Platform:** iOS 26+, Swift 6, SwiftUI, SwiftData, on-device `FoundationModels`.

**Build status (2026-09-15):** Phases 0–10 and 12–23 + 25–36 are in code. Phase 11 device/TestFlight is still manual. Phase 24 CloudKit is **held**. See `phasesOfProduction` and `HANDOFF.md` for the tracker — this file is the *why* and the design rules, not the sprint list.

**Shipped vs older sentences below (do not revert):**
- Media (YouTube/TikTok/X/IG): **poster + open in the host app**, not an in-reader WKWebView embed (YouTube embed error 152).
- App chrome uses asset `bgColor` (light `#EBEBEB` / dark `#000000`) plus glass; card tints stay content-derived and capped.
- Library hub = Shelves \| Types \| Tags, plus one-shot “Suggest a Shelf” when Apple Intelligence is available.
- Tags = closed AI taxonomy **and** user-created labels. Collections stay separate shelves.
- Monetization: StoreKit 2 non-consumable `pocketbookmark.unlimited`; free = **20** active items (`deletedAt == nil`; archive counts). Saves never fail over the cap.
- Sync: still off. Models remain CloudKit-safe. Do not enable CloudKit unless asked (Phase 24 held).

---

## PART 0: Product Principles

These are the tie-breakers. When two designs are both defensible, pick the one that serves the principle higher on this list.

1. **Deference.** The saved content is the product. Our UI is a frame, never a painting.
2. **Zero friction in, gentle pressure out.** Saving must be effortless; consuming must feel inviting, never nagging.
3. **On-device or nothing.** No accounts, no servers, no telemetry. Privacy is a feature we advertise.
4. **Degrade gracefully, never blank.** Apple Intelligence is unavailable on many devices. Every AI feature must have a non-AI fallback that still works.
5. **Never lose a save.** A failed parse, a dead network, a killed extension — the URL still lands in the inbox. Enrichment is always retryable.

### Explicit Non-Goals (v1)

- No cross-device sync at launch (but the data model is CloudKit-ready from day one — see Data Model Rules).
- No web app, no Mac app, no Android.
- No social features, sharing feeds, or public collections.
- No server-side scraping fallback. If the device can't parse it, we show a rich link card and move on.

---

## PART 1: The Design Bible

The app adheres to Apple's HIG "Liquid Glass" language: translucent materials, content-derived color, and fluid, physics-driven motion.

### 1.1 Visual Language & Materials

**Liquid Glass motif.** Avoid heavy, opaque navigation chrome. Use `.ultraThinMaterial` for floating surfaces (toolbars, the audio player bar, sheets) so the user's saved thumbnails bleed through as they scroll.

Concrete rules:
- Navigation bar: `.toolbarBackground(.ultraThinMaterial, for: .navigationBar)` with `.toolbarBackgroundVisibility(.automatic, ...)` so it materializes on scroll only.
- Floating controls sit in `safeAreaInset`, never pinned with opaque backgrounds.
- Use `.glassEffect()` / `GlassEffectContainer` where iOS 26 provides it; fall back to `.ultraThinMaterial` + `.background(in:)` shapes.
- Shadows are soft and wide (`radius: 20, y: 8`), never hard drop shadows.

**Content-derived theming.** There is no brand color. The dominant color of the current item's thumbnail subtly tints backgrounds, accents, and the reader chrome.

Implementation rule (important): dominant color is computed **once, at ingest time**, and persisted on the model as three `Double`s (RGB). Never compute color during scrolling. Use Core Image `CIKMeans` (k=4) on a downscaled thumbnail, discard results with luminance > 0.92 or saturation < 0.15, pick the most-saturated survivor. Fall back to `CIAreaAverage`, then to a neutral gray.

Tints must be *subtle*: cap applied opacity at ~0.18, and always validate contrast against `Color.primary` before tinting text-bearing surfaces.

**Typography.** SF Pro exclusively. Oversized bold display type for section headers (`.largeTitle.bold()` and up); reader-optimized serif or SF Pro Text for long-form body. Full Dynamic Type support is **mandatory** — every font uses semantic text styles or `.custom(..., relativeTo:)`. The layout must survive `.accessibility5`.

**Dark mode is the default assumption.** Design dark-first, verify light. Content-derived tints behave very differently between the two; both need a pass.

### 1.2 Layout & Architecture

**The "Inbox" mentality.** The home screen is an asymmetrical masonry grid, not a file directory. A vertical TikTok thumbnail sits next to a horizontal YouTube still next to a square article preview, each card sized by its true aspect ratio.

Layout technique: two (or three, on iPad/landscape) `LazyVStack` columns inside an `HStack`, with items assigned to whichever column is currently shortest. **Do not use the `Layout` protocol** for this — `Layout` measures all subviews eagerly and destroys performance past a few hundred items.

**Gestures over buttons.**
- Swipe right on a card → Archive (marks consumed).
- Swipe left on a card → **Organize** sheet (AI Tags + user Collections in one place).
- Long press → context menu: Add to Collection, Listen to Summary, Extract Core Info, Copy Link, Share, Delete.

Gesture caveat: horizontal card swipes inside a vertical scroll view conflict. Use a `DragGesture(minimumDistance: 20)` with an explicit horizontal-dominance check (`abs(dx) > abs(dy) * 1.5`) before engaging, and let the scroll view win otherwise. Every swipe action must **also** be reachable from the long-press context menu — swipes are an accelerator, never the only path. VoiceOver users get `.accessibilityAction` equivalents.

**Every destructive or semi-destructive action is undoable.** Archive, delete, and purge all post a transient undo affordance. Deleted items go to a Trash that empties after 30 days.

### 1.3 Micro-Interactions & Haptics

**The save dopamine hit.** Saving via the Share Sheet fires a crisp `.impact(flexibility: .soft)` haptic (via SwiftUI's `.sensoryFeedback(...)`, not raw `UIImpactFeedbackGenerator`) alongside a spring-driven checkmark draw-on. This is the single most-repeated interaction in the app; it deserves disproportionate polish.

**Fluid transitions.** Tapping a card morphs the thumbnail into the full-screen reader.

Technique correction: use **`.matchedTransitionSource(id:in:)` + `.navigationTransition(.zoom(sourceID:in:))`** for push/present transitions. `matchedGeometryEffect` is for same-hierarchy morphs and is fragile across navigation boundaries; reserve it for in-place expansions only.

**Motion vocabulary.** One spring, used everywhere: `.spring(response: 0.42, dampingFraction: 0.82)`. Snappier variant for micro-feedback: `.spring(response: 0.28, dampingFraction: 0.9)`. Respect `accessibilityReduceMotion` by swapping to cross-fades.

---

## PART 2: Feature Specification

### 2.1 The Zero-Friction Ingestion Engine

**Smart Share Extension.** Save from Safari, X, TikTok, Instagram, Reddit, YouTube in under one second.

The extension's only job is to **capture and commit fast**, then call `completeRequest`. It writes a minimal record (`url`, whatever title came free, `status = .pending`) into the shared SwiftData store and exits. It does not fetch, parse, or run AI. Share extensions run under a hard memory ceiling (~120 MB) and get killed without warning; doing real work there is how you lose saves.

**In-app paste & save.** Share is the fastest path from other apps, but it must not be the only path. Home offers a `+` / “Paste a link” sheet: paste or type a URL, optional title, Save. That path calls the **same** `ShareSaveService` as the extension so duplicates, the offline fallback queue, and enrichment behave identically. Clipboard is read only on explicit Paste (or a one-shot “Link on clipboard?” offer on foreground) — never polled silently.

**Reality check on metadata scraping.** `NSExtensionJavaScriptPreprocessingFile` only runs when the host app is **Safari** (or another `WKWebView`-based browser that supports it). Sharing from the TikTok, Instagram, or X apps gives you a bare `NSURL` and maybe a title string — no DOM, no Open Graph tags. So:

- **From Safari:** JS preprocessing grabs `document.title`, `og:image`, `og:description`, and canonical URL instantly. Best case.
- **From every other app:** we get a URL. Metadata enrichment happens later, in the main app.

This means enrichment must be a first-class background pipeline, not an afterthought.

**Enrichment pipeline (runs in the main app).** Every pending item moves through: fetch → triage by domain → extract → thumbnail → dominant color → AI tags → `status = .ready`. Each stage is independently retryable, and failure at any stage leaves the item usable (a link card with a favicon is still a valid bookmark). Items show their state honestly in the UI — a shimmer placeholder while enriching, a quiet "tap to retry" chip on failure.

**Offline caching.** Article text and thumbnails are downloaded on ingest so the inbox is fully usable on a plane. Thumbnails use `@Attribute(.externalStorage)` so the SQLite store stays small and queries stay fast.

### 2.2 The Universal Canvas (Playback & Reading)

**Native Reader Mode.** Distraction-free reading with adjustable font family, size, line spacing, margin width, and background theme (System / Sepia / Paper / Black). Settings persist globally, not per-article.

**Rich media.** TikTok, YouTube, X, Instagram, and Reddit show a **poster thumbnail** and open in the host app / Safari. In-reader `WKWebView` YouTube embeds were tried and failed (error 152); do not bring them back without a new working approach.

Reality check on metadata / playback:
- **YouTube / TikTok:** oEmbed (or OG) for title + poster. Playback is external.
- **X/Twitter:** public oEmbed is effectively dead (auth-gated). OG metadata + open the URL.
- **Instagram:** oEmbed requires a Facebook app token. We will not ship that. OG + open the URL.

`MediaHeroView` is the media surface (`EmbedPlayerView` is a typealias for compatibility). A dead API should degrade one platform, not the whole reader.

**Progress tracking.** Remember scroll position in articles and playback position in video. Use `onScrollGeometryChange` / `ScrollPosition` to persist a normalized 0–1 offset, debounced. On reopen, restore with a brief highlight of the resume point rather than a silent jump.

**Auto-archive on completion.** Scrolling past ~95% of an article or finishing a video offers to archive it inline. This is how the inbox actually drains.

### 2.3 The Apple Intelligence Layer

All AI is on-device via `FoundationModels`. No OpenAI, no Anthropic, no network LLM calls, ever.

**Availability is not guaranteed.** Before any AI feature renders, check `SystemLanguageModel.default.availability`. Handle all cases: unsupported device, Apple Intelligence disabled, model still downloading. AI-only UI is hidden (not disabled-and-confusing) when unavailable. Every AI feature below names its fallback.

**Auto-tagging.** After parsing, the article text is passed to a `LanguageModelSession` that returns a `@Generable` struct of 3 tags drawn from a **fixed, closed taxonomy** (use `@Guide` to constrain the enum). Free-form tag generation produces synonym sprawl — `#AI`, `#ArtificialIntelligence`, `#MachineLearning` — that makes filtering useless. Users can toggle taxonomy tags manually in the Organize sheet.
*Fallback:* domain-based heuristic tags (`youtube.com` → `#Video`, a recipe schema.org marker → `#Recipes`).

### 2.3b Collections (user shelves)

**Tags classify; Collections curate.** Tags answer “what is this?” with a shared vocabulary. Collections answer “where do I want this?” with shelves the user owns — Recipes, News, Weekend Reads, Trip planning.

**Organize sheet (one sheet, two jobs).** Swipe-left (and the matching context-menu item) open a single liquid-glass sheet:
1. **Tags** — closed taxonomy toggles (AI suggestions pre-checked when present).
2. **Collections** — membership toggles for existing shelves + “New Collection…” (name + SF Symbol).

Do not ship two separate menus. Swipes stay accelerators; Organize is also on the long-press menu as “Add to Collection…” / “Organize.”

**Collections hub.** A dedicated destination (toolbar from Home), not a strip of pills on the inbox. First viewport: brand-calm title “Collections”, one short line (“Your shelves”), primary create control, then a grid of shelf cards. Each card is a glass surface with a 2×2 thumbnail mosaic from members (or a large SF Symbol if empty), the name, and a count. No stats strip, no nested dashboards. Tapping opens a masonry detail of members (same card language as the inbox). Deleting a collection never deletes bookmarks — only the shelf.

**Context menu.** Long-press includes “Add to Collection…” alongside Listen to Summary, Extract Core Info, Copy Link, Share, Delete.

**Data.** `Collection` is its own SwiftData model (many-to-many with `Item`), CloudKit-safe like `Tag`. Keep `Tag` and `Collection` separate — conflating them forces free-form spam into search facets or locks shelves to the AI taxonomy.

### 2.3c Continue: extraction & search

**"Cut the Fluff" extraction.** A "Extract Core Info" button in the reader maps the article into a `@Generable` struct — `Recipe` (ingredients, steps, times, yield) or `TutorialSteps` — rendered as a clean SwiftUI list. This is the single best demo of the app; make it fast and make the result shareable/exportable.
*Fallback:* hidden when the model is unavailable.

**Smart Search.** Natural-language search: *"that pasta video from last week."*

Architecture correction: do **not** feed the whole library to the LLM. Two-layer approach:
1. **Structured:** the LLM converts the query into a `@Generable SearchFilter` (keywords, date range, platform, tags, read state) which becomes a `#Predicate`. This is fast, exact, and handles "last week" and "videos" correctly.
2. **Semantic:** `NLEmbedding` / `NLContextualEmbedding` vectors computed at ingest, cosine-ranked against the query embedding, for fuzzy topical matching.

Results merge the two. *Fallback:* plain substring + tag search, which is genuinely fine for most queries.

**Token budget is real.** The on-device model has a small context window (a few thousand tokens). Any full article will overflow it. All long-text features must chunk and map-reduce: summarize sections, then summarize the summaries. Build this once in `AIEngine` and reuse it.

**Guardrails will fire.** Arbitrary web content trips safety filters. Catch `LanguageModelSession` errors, retry once with a more neutral prompt, then fail softly to the non-AI path. Never surface a raw error to the user.

### 2.4 The Audio Engine ("Daily Digest")

**Contextual summarization.** "Play Daily Digest" gathers unread articles from the last 48 hours, map-reduces them into a cohesive spoken script with the on-device model, and reads it aloud.

The script is **segmented per article**, not one blob — this gives us skip-forward/back between stories, a visible "now playing" title, and the ability to tap through to the source. Cache generated scripts so replaying doesn't re-run the model.

**Native TTS** via `AVSpeechSynthesizer` with an enhanced/premium voice. Personal Voice requires `AVSpeechSynthesizer.requestPersonalVoiceAuthorization()` and is opt-in.

The original plan missed the pieces that make audio actually usable — all of these are required:
- `AVAudioSession` category `.playback`, activated on start and deactivated on finish.
- `UIBackgroundModes: audio` so it survives screen lock.
- `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter` for lock screen, Control Center, AirPods, and CarPlay controls.
- Interruption and route-change handling (a phone call must pause, not kill, the digest).

*Fallback:* with no model available, TTS reads the article text directly. Still valuable.

### 2.5 Inbox Zero Mechanics

**Aging, not deleting.** The original "14-day purge" is too aggressive as a default — nobody trusts an app that deletes their stuff. Reframed:

- Items older than 14 days fade slightly and move to an "Aging" section.
- The user gets a periodic, dismissible "Tidy Up" prompt offering one-tap archive of the whole aging set.
- Fully automatic archive-after-N-days exists as an **opt-in** setting, default off, configurable (7/14/30 days), and archives rather than deletes.
- Nothing is ever permanently deleted without passing through Trash.

**Stats, gently.** A small "12 saved, 9 read this month" summary. Encouraging, never a streak counter or guilt engine.

### 2.6 Additions Worth Building (high value, low cost)

These weren't in the original spec and materially improve the product:

- **Spotlight indexing.** Index every item as a `CSSearchableItem`. Users find their saves from the system search field without opening the app. Cheap to build, feels like magic.
- **App Intents + Shortcuts.** Expose "Save to PocketBookmark" and "Play my Daily Digest" as intents. Gets us Siri, the Action button, and automations for free.
- **Home screen widget.** Unread count plus the next thing to read, tappable straight into the reader.
- **Collections.** User-made shelves on top of AI tags — see §2.3b. First-class phase, not a stretch goal.
- **In-app paste/save.** Capture a URL without the share sheet — see §2.1.

---

## PART 3: Data Model Rules

These constrain Phase 1 and are expensive to change later. Decide now.

**CloudKit-readiness from day one.** Even though v1 doesn't sync, SwiftData + CloudKit imposes rules that are painful to retrofit: every property needs a default value or must be optional, `@Attribute(.unique)` is forbidden, and every relationship needs an explicit inverse and must be optional. Follow these from the first model, and enabling sync later is a configuration change instead of a migration nightmare.

**Store enums as raw `String`.** `#Predicate` support for custom enum types is unreliable. Persist `sourcePlatformRaw: String` with a computed `sourcePlatform` accessor, and write predicates against the raw value.

**Tags are a model, not a `[String]`.** A `Tag` entity with a many-to-many relationship to `Item` makes filtering, renaming, and counting trivial; a string array makes all three awkward.

**Collections are a separate model from Tags.** Same many-to-many pattern, different ownership: Collections are always user-created shelves; Tags stay the closed AI taxonomy (plus manual toggles of those names). Do not overload `Tag.isUserCreated` to mean “collection.”

**Large blobs use `@Attribute(.externalStorage)`.** Thumbnails and full article text stay out of the SQLite row, keeping list queries fast.

**Dominant color persists as three `Double`s**, computed once at ingest.

**Concurrency.** `ModelContainer` is `Sendable`; `ModelContext` is not. Background ingestion runs in a `@ModelActor`, never by passing a context across isolation boundaries. UI-facing view models are `@MainActor`.

**Cross-process change notification.** SwiftData does not automatically merge writes made by the Share Extension into a running app's context. The extension posts a Darwin notification (`CFNotificationCenterGetDarwinNotifyCenter`); the app listens, and on receipt — and on every foreground — re-runs its queries. Treat "the store changed underneath me" as normal, not exceptional.
