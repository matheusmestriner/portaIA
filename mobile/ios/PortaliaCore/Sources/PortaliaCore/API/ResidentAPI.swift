import Foundation

public final class ResidentAPI {
    private let http: HTTPClient
    public init(http: HTTPClient) { self.http = http }

    struct LoginBody: Encodable { let email: String; let password: String }
    public func login(email: String, password: String) async throws -> ResidentLoginResponse {
        let body = try http.encode(LoginBody(email: email, password: password))
        return try await http.send(APIRequest(path: "resident-auth/login", method: "POST", body: body))
    }

    struct RefreshBody: Encodable { let refreshToken: String }
    public func refresh(refreshToken: String) async throws -> ResidentRefreshResponse {
        let body = try http.encode(RefreshBody(refreshToken: refreshToken))
        return try await http.send(APIRequest(path: "resident-auth/refresh", method: "POST", body: body))
    }

    public func logout(accessToken: String) async throws {
        try await http.send(APIRequest(path: "resident-auth/logout", method: "POST", headers: authHeader(accessToken)))
    }

    struct ChangePasswordBody: Encodable { let currentPassword: String; let newPassword: String }
    public func changePassword(accessToken: String, current: String, new: String) async throws -> ResidentChangePasswordResponse {
        let body = try http.encode(ChangePasswordBody(currentPassword: current, newPassword: new))
        return try await http.send(APIRequest(path: "resident-auth/change-password", method: "POST", body: body, headers: authHeader(accessToken)))
    }

    public func me(accessToken: String) async throws -> ResidentMeResponse {
        try await http.send(APIRequest(path: "resident/me", headers: authHeader(accessToken)))
    }

    public func dashboard(accessToken: String) async throws -> ResidentDashboardResponse {
        try await http.send(APIRequest(path: "resident/dashboard", headers: authHeader(accessToken)))
    }

    public func listAnnouncements(accessToken: String, page: Int = 1, pageSize: Int = 20) async throws -> Paginated<AnnouncementResponse> {
        try await http.send(APIRequest(
            path: "resident/announcements",
            query: ["page": "\(page)", "pageSize": "\(pageSize)"],
            headers: authHeader(accessToken)
        ))
    }

    public func listDeliveries(accessToken: String, page: Int = 1, pageSize: Int = 20) async throws -> Paginated<DeliveryResponse> {
        try await http.send(APIRequest(
            path: "resident/deliveries",
            query: ["page": "\(page)", "pageSize": "\(pageSize)"],
            headers: authHeader(accessToken)
        ))
    }

    public func issueDeliveryCredential(accessToken: String, deliveryId: String) async throws -> DeliveryCredentialResponse {
        try await http.send(APIRequest(
            path: "resident/deliveries/\(deliveryId)/credential",
            method: "POST",
            headers: authHeader(accessToken, idempotencyKey: UUID().uuidString)
        ))
    }

    public func telephonyCredentials(accessToken: String) async throws -> ResidentTelephonyCredentials {
        try await http.send(APIRequest(path: "resident/telephony/credentials", headers: authHeader(accessToken)))
    }

    private func authHeader(_ accessToken: String, idempotencyKey: String? = nil) -> [String: String] {
        var headers = ["Authorization": "Bearer \(accessToken)"]
        if let idempotencyKey { headers["Idempotency-Key"] = idempotencyKey }
        return headers
    }
}
