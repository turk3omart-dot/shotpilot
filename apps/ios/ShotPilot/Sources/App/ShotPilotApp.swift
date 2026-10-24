import SwiftUI

@main
struct ShotPilotApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.token == nil {
                    SignInView()
                } else {
                    HomeView()
                }
            }
            .environmentObject(session)
            .tint(SPColor.accent)
        }
    }
}
