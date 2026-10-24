import Foundation
import Security

/// Holds the session token in the Keychain (never UserDefaults).
@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var token: String?
    private let service = "app.shotpilot.session"

    init() { token = Self.read(service: service) }

    var api: APIClient { APIClient(token: token) }

    func signIn(email: String, password: String) async throws {
        struct Body: Encodable { let email: String; let password: String }
        struct Result: Decodable { let token: String; let user: UserDTO }
        let result: Result = try await APIClient().request("auth/sign-in", method: "POST", body: Body(email: email, password: password))
        Self.write(result.token, service: service)
        token = result.token
    }

    func signOut() {
        SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
        token = nil
    }

    private static func write(_ value: String, service: String) {
        let query = [kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary
        SecItemDelete(query)
        let attrs = [kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecValueData: Data(value.utf8),
                     kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly] as CFDictionary
        SecItemAdd(attrs, nil)
    }

    private static func read(service: String) -> String? {
        let query = [kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecReturnData: true, kSecMatchLimit: kSecMatchLimitOne] as CFDictionary
        var out: AnyObject?
        guard SecItemCopyMatching(query, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
