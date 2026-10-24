import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("ShotPilot").font(.largeTitle.bold())
            Text("From the first idea to the final frame.").foregroundStyle(.secondary)
            TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                .padding().background(SPColor.surface, in: .rect(cornerRadius: 10))
            SecureField("Password", text: $password).textContentType(.password)
                .padding().background(SPColor.surface, in: .rect(cornerRadius: 10))
            if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            Button {
                Task {
                    loading = true; defer { loading = false }
                    do { try await session.signIn(email: email, password: password) } catch { self.error = error.localizedDescription }
                }
            } label: {
                Text(loading ? "Signing in…" : "Sign in").frame(maxWidth: .infinity).padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(loading || email.isEmpty || password.isEmpty)
        }
        .padding(24)
        .frame(maxHeight: .infinity)
        .background(SPColor.background)
    }
}
