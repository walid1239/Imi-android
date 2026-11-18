# Project inventory

- Native Android entry point: `app/src/main/java/com/walid/chat/MainActivity.kt`
- Compose app navigation and screens: `app/src/main/java/com/walid/chat/ui/`
- Theme and shared components: `ui/theme/`, `ui/components/`
- Core destinations and feature-state declarations: `core/`
- Chat domain model and repository contract: `data/`
- Unit tests: `app/src/test/java/com/walid/chat/core/FeatureStatusTest.kt`
- CI build workflow: `.github/workflows/android-build.yml`

The current repository is a UI and architecture foundation. Firebase dependencies are declared but no Firebase configuration or live repository implementation is included. Messaging, authentication, media upload/playback feeds, status expiry, and WebRTC calling are not yet implemented as working services. The workflow builds a debug APK only; it does not sign a production release.
