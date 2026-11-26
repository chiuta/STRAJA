# Changelog

README files, the presentation page and the app are in 8 languages (en, ro, fr, it, es, pt, de, hu); this changelog is English only.

## 1.0.0 — 2026-11-26

* First release. Capacitor 8 app (Android + iOS), offline, no INTERNET permission.
* Android: access audit (notification listeners, accessibility services, default assistant, media/SMS permissions), per-app and device risk score, background monitor with baseline diff, deep links to the exact system settings screens.
* iOS: guide mode (checklist, manual registry, temporary-access reminders, weekly review reminder).
* Temporary-access reminders, weekly review reminder, report export, FLAG_SECURE on the app's own window.
* UI, notifications, README and presentation page in 8 languages.
* GitHub Actions: tests, signed Android APK (ephemeral key when no secrets), unsigned iOS IPA, release on `v*` tags.
