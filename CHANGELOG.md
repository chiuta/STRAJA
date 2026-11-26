# Changelog

README files, the presentation page and the app are in 8 languages (en, ro, fr, it, es, pt, de, hu); this changelog is English only.

## 1.0.1 — 2026-11-26

* Fix: black screen on Android launch. The UI called `Capacitor.registerPlugin`, which is not provided by the native bridge, so the script stopped before drawing anything. The app now ships the `@capacitor/core` runtime (`www/capacitor.js`), falls back to `Capacitor.Plugins`, and a startup guard shows any error instead of a blank screen.
* Tests now run the page against the real `native-bridge.js` (`test/android-bridge.test.js`).

## Presentation page — 2026-11-26

* Screenshots on every feature card (6 per language, tap to enlarge), recorded from the real app UI (`tools/make_feature_shots.py`).
* Video clips for the main features (audit, one tap to the right screen, background monitor, temporary access, protection guide) in 8 languages, recorded from the real app interface with a simulated Android bridge (`tools/make_clips.py`); system settings screens are shown as a placeholder sheet.

## 1.0.0 — 2026-11-26

* First release. Capacitor 8 app (Android + iOS), offline, no INTERNET permission.
* Android: access audit (notification listeners, accessibility services, default assistant, media/SMS permissions), per-app and device risk score, background monitor with baseline diff, deep links to the exact system settings screens.
* iOS: guide mode (checklist, manual registry, temporary-access reminders, weekly review reminder).
* Temporary-access reminders, weekly review reminder, report export, FLAG_SECURE on the app's own window.
* UI, notifications, README and presentation page in 8 languages.
* GitHub Actions: tests, signed Android APK (ephemeral key when no secrets), unsigned iOS IPA, release on `v*` tags.
