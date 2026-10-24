import Foundation

struct APIError: Error, Decodable, LocalizedError {
    let code: String
    let message: String
    var errorDescription: String? { message }
}

/// Minimal client for /api/v1. All authorization happens on the server.
struct APIClient {
    var baseURL: URL = URL(string: Bundle.main.object(forInfoDictionaryKey: "SHOTPILOT_API_BASE_URL") as? String ?? "http://localhost:3000")!
    var token: String?

    private struct Envelope<T: Decodable>: Decodable { let data: T?; let error: APIError? }

    func request<T: Decodable>(_ path: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/v1").appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONEncoder().encode(body) }
        let (data, _) = try await URLSession.shared.data(for: req)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let env = try decoder.decode(Envelope<T>.self, from: data)
        if let error = env.error { throw error }
        guard let value = env.data else { throw APIError(code: "EMPTY", message: "Empty response") }
        return value
    }
}

struct UserDTO: Decodable, Identifiable { let id: String; let name: String; let email: String }
struct WorkspaceDTO: Decodable, Identifiable { let id: String; let name: String; let slug: String; let role: String }
struct ProjectDTO: Decodable, Identifiable { let id: String; let name: String; let type: String; let phase: String }
