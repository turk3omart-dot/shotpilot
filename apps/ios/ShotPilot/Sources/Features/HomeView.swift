import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var workspaces: [WorkspaceDTO] = []
    @State private var projects: [ProjectDTO] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                if let error { Text(error).foregroundStyle(.red) }
                Section("Projects") {
                    ForEach(projects) { p in
                        VStack(alignment: .leading) {
                            Text(p.name).font(.headline)
                            Text(p.phase.replacingOccurrences(of: "_", with: " ").capitalized).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if projects.isEmpty { Text("No projects yet").foregroundStyle(.secondary) }
                }
            }
            .navigationTitle(workspaces.first?.name ?? "Home")
            .toolbar { Button("Sign out") { session.signOut() } }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        struct Me: Decodable { let user: UserDTO; let workspaces: [WorkspaceDTO] }
        do {
            let me: Me = try await session.api.request("me")
            workspaces = me.workspaces
            if let ws = me.workspaces.first { projects = try await session.api.request("workspaces/\(ws.id)/projects") }
        } catch { self.error = error.localizedDescription }
    }
}
