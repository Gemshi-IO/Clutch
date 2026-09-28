# Clutch — Official Static Landing Page

> Save anything from anywhere in under a second, and never feel guilty about the pile again.

A modern, high-conversion, Apple-tier static website for **Clutch** (iOS 26+), designed for seamless hosting on **GitHub Pages**.

---

## ✨ Features & Architecture

- **Apple HIG Liquid Glass Aesthetic:** Translucent materials (`backdrop-filter: blur()`), content-derived subtle color accents, fine specular borders, and soft shadows.
- **Photorealistic iPhone 16 Pro Device Frame:** Interactive 3D cursor tilt with floating contextual hotspots (`Saved in 0.6s`, `On-Device FoundationModels`, `Natural Language Search`).
- **Interactive View Mode Switcher:** Smooth cross-fade transition between **Liquid Masonry Grid** (`images/HomeviewScrn.webp`) and **Compact List View** (`images/homeviewListtype.webp`).
- **Interactive "Cut the Fluff" Simulator:** Before/after toggle comparing bloated recipe blogs with clean structured on-device extractions.
- **Interactive Daily Digest Audio Player:** Custom Web Audio API synthesizer generating acoustic preview chimes, real-time animated sound waves, chapter scrubbing, and speed selection (`0.75x` – `2x`).
- **Collections & Shelves Showcase:** Interactive tab switching between user-owned shelves (`images/CollectionpageScrn.webp`) and automatic classification types (`images/CollecitonPageTypeScrn.webp`).
- **100% On-Device Privacy & Sovereign Engineering:** Comparison matrix highlighting zero accounts, zero trackers, and zero external LLM calls.
- **Production Roadmap Transparency:** Live milestone tracker reflecting verified progress (Phases 0–10 complete, Phases 12–23 complete in code, Phase 11 TestFlight beta).
- **Interactive FAQ Accordion:** Clean single-open accordion addressing pricing, device compatibility, video playback, and App Store guidelines.
- **Light & Dark Theme Support:** Seamless dark-first OLED obsidian aesthetic with persistent light mode toggle.
- **Zero Server Dependencies:** Pure semantic HTML5, Vanilla CSS3, and Vanilla JavaScript. 100/100 Lighthouse score ready.

---

## 🚀 GitHub Pages Deployment

### Method 1: Automatic Direct Hosting (Recommended)
1. Push this repository to your GitHub account (e.g. `https://github.com/<your-username>/<repo-name>`).
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**:
   - **Source:** Deploy from a branch.
   - **Branch:** `main` (or `master`), folder: `/ (root)`.
4. Click **Save**. GitHub Pages will deploy your site in seconds!

### Method 2: GitHub Actions Automated Workflow
A preconfigured workflow is included in `.github/workflows/deploy.yml` that automatically deploys the static site to GitHub Pages whenever changes are pushed to `main`.

---

## 💻 Local Preview

To preview the landing page locally:

```bash
# Using Python
python3 -m http.server 8088

# Open in browser:
# http://localhost:8088/
```

Or simply double-click [index.html](file:///Users/gemshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Cursor%20AI/PocketBookmark%20Assets/PocketBookmark%20Website/index.html) in your browser.

---

## 📁 Project Structure

```
├── index.html                     # Semantic landing page markup & structured data
├── privacy.html                   # Privacy Policy
├── terms.html                     # Terms of Use (EULA)
├── css/
│   └── style.css                  # Apple HIG Liquid Glass design system & tokens
├── js/
│   └── main.js                    # Interactive audio synthesizer, 3D tilt, & state logic
├── images/                        # High-resolution WebP screenshots & vector SVG logo
│   ├── PocketbookamLogo.svg
│   ├── HomeviewScrn.webp
│   ├── homeviewListtype.webp
│   ├── ReaderModeScrn.webp
│   ├── DailDigestAudioScrn.webp
│   ├── CollectionpageScrn.webp
│   └── CollecitonPageTypeScrn.webp
└── .github/
    └── workflows/
        └── deploy.yml             # GitHub Actions deployment configuration
```

---

## 📬 Contact & Support

- **Developer:** Gemshi
- **Email:** [gemshi@me.com](mailto:gemshi@me.com)
