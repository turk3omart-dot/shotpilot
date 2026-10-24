# ShotPilot iOS (SwiftUI) — scaffold

**Status: source scaffold only. It has not been compiled** — the cloud environment it was written in
has no Xcode. Expect small fixes on first build.

It talks to the web app's JSON API (`/api/v1/*`, bearer-token auth) — the same server-side
authorization as the web app, so a crew member's phone can never receive budget data.

## Create the Xcode project (on a Mac, Xcode 16+)

1. Xcode → File → New → Project → iOS App. Product name `ShotPilot`, interface SwiftUI,
   language Swift, minimum iOS 17. Save it in `apps/ios/`.
2. Delete the generated `ContentView.swift` and `ShotPilotApp.swift`.
3. Drag `apps/ios/ShotPilot/Sources` into the project (Create groups, add to target).
4. In the target's Info, add `SHOTPILOT_API_BASE_URL` (String) = `http://localhost:3000`
   for the simulator. For a device, use your Mac's LAN IP and allow local networking.
5. Run the web app (`pnpm dev`) and the simulator. Sign in with a demo account (`pnpm db:seed`).

## Planned native features (see IMPLEMENTATION_PLAN.md)
Face ID unlock of the stored token (Keychain), push notifications for call-sheet changes,
offline cache of today's call sheet, camera uploads for location scouting, calendar export,
deep links (`shotpilot://p/<projectId>`).
