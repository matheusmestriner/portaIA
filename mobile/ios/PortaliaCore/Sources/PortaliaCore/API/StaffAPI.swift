import Foundation

/// Chamadas HTTP cruas de equipe — sem lógica de sessão/retry aqui (isso é
/// StaffSession). Cada método monta a APIRequest e deixa o HTTPClient
/// cuidar de cookies (URLSession já persiste o refresh cookie sozinho).
public final class StaffAPI {
    private let http: HTTPClient
    public init(http: HTTPClient) { self.http = http }

    struct LoginBody: Encodable { let email: String; let password: String }
    public func login(email: String, password: String) async throws -> StaffLoginResponse {
        let body = try http.encode(LoginBody(email: email, password: password))
        return try await http.send(APIRequest(path: "auth/login", method: "POST", body: body))
    }

    public func refresh(csrfToken: String) async throws -> StaffRefreshResponse {
        try await http.send(APIRequest(path: "auth/refresh", method: "POST", headers: ["X-CSRF-Token": csrfToken]))
    }

    public func logout(accessToken: String, csrfToken: String) async throws {
        try await http.send(APIRequest(
            path: "auth/logout",
            method: "POST",
            headers: ["Authorization": "Bearer \(accessToken)", "X-CSRF-Token": csrfToken]
        ))
    }

    struct ChangePasswordBody: Encodable { let currentPassword: String; let newPassword: String }
    public func changePassword(accessToken: String, current: String, new: String) async throws -> StaffChangePasswordResponse {
        let body = try http.encode(ChangePasswordBody(currentPassword: current, newPassword: new))
        return try await http.send(APIRequest(
            path: "auth/change-password",
            method: "POST",
            body: body,
            headers: ["Authorization": "Bearer \(accessToken)"]
        ))
    }

    public func me(accessToken: String) async throws -> StaffMeResponse {
        try await http.send(APIRequest(path: "auth/me", headers: authHeader(accessToken)))
    }

    public func reportsOverview(accessToken: String, condominiumId: String) async throws -> ReportsOverview {
        try await http.send(APIRequest(
            path: "reports/overview",
            query: ["condominiumId": condominiumId],
            headers: authHeader(accessToken)
        ))
    }

    public func listUnits(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 50) async throws -> Paginated<UnitResponse> {
        try await http.send(APIRequest(
            path: "condominial/units",
            query: ["condominiumId": condominiumId, "page": "\(page)", "pageSize": "\(pageSize)"],
            headers: authHeader(accessToken)
        ))
    }

    public func listAnnouncements(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 20) async throws -> Paginated<AnnouncementResponse> {
        try await http.send(APIRequest(
            path: "notifications/announcements",
            query: ["condominiumId": condominiumId, "page": "\(page)", "pageSize": "\(pageSize)"],
            headers: authHeader(accessToken)
        ))
    }

    public func listExtensions(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 100) async throws -> Paginated<ExtensionResponse> {
        try await http.send(APIRequest(
            path: "telephony/extensions",
            query: ["condominiumId": condominiumId, "page": "\(page)", "pageSize": "\(pageSize)"],
            headers: authHeader(accessToken)
        ))
    }

    public func listCalls(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 20) async throws -> Paginated<CallResponse> {
        try await http.send(APIRequest(
            path: "telephony/calls",
            query: ["condominiumId": condominiumId, "page": "\(page)", "pageSize": "\(pageSize)"],
            headers: authHeader(accessToken)
        ))
    }

    struct OriginateCallBody: Encodable { let calleeExtensionId: String; let triggeredBy: String; let externalCallId: String }
    public func originateCall(accessToken: String, calleeExtensionId: String, triggeredBy: String) async throws -> CallResponse {
        let body = try http.encode(OriginateCallBody(calleeExtensionId: calleeExtensionId, triggeredBy: triggeredBy, externalCallId: UUID().uuidString))
        return try await http.send(APIRequest(
            path: "telephony/calls",
            method: "POST",
            body: body,
            headers: authHeader(accessToken, idempotencyKey: UUID().uuidString)
        ))
    }

    public func listDeliveries(accessToken: String, condominiumId: String, status: String? = nil, page: Int = 1, pageSize: Int = 20) async throws -> Paginated<DeliveryResponse> {
        var query = ["condominiumId": condominiumId, "page": "\(page)", "pageSize": "\(pageSize)"]
        if let status { query["status"] = status }
        return try await http.send(APIRequest(path: "gatehouse/deliveries", query: query, headers: authHeader(accessToken)))
    }

    struct CreateDeliveryBody: Encodable {
        let unitId: String
        let description: String
        let carrier: String?
        let courierName: String?
        let volumeCount: Int
    }
    public func createDelivery(accessToken: String, unitId: String, description: String, carrier: String?, courierName: String?, volumeCount: Int = 1) async throws -> DeliveryCredentialResponse {
        let body = try http.encode(CreateDeliveryBody(unitId: unitId, description: description, carrier: carrier, courierName: courierName, volumeCount: volumeCount))
        return try await http.send(APIRequest(
            path: "gatehouse/deliveries",
            method: "POST",
            body: body,
            headers: authHeader(accessToken, idempotencyKey: UUID().uuidString)
        ))
    }

    struct RedeemDeliveryBody: Encodable { let credential: String; let pickedUpBy: String }
    public func redeemDelivery(accessToken: String, credential: String, pickedUpBy: String) async throws -> DeliveryResponse {
        let body = try http.encode(RedeemDeliveryBody(credential: credential, pickedUpBy: pickedUpBy))
        return try await http.send(APIRequest(
            path: "gatehouse/deliveries/redeem",
            method: "POST",
            body: body,
            headers: authHeader(accessToken, idempotencyKey: UUID().uuidString)
        ))
    }

    struct TriggerPanicBody: Encodable { let condominiumId: String; let triggeredBy: String }
    public func triggerPanicAlert(accessToken: String, condominiumId: String, triggeredBy: String) async throws -> PanicAlertResponse {
        let body = try http.encode(TriggerPanicBody(condominiumId: condominiumId, triggeredBy: triggeredBy))
        return try await http.send(APIRequest(
            path: "security/panic-alerts",
            method: "POST",
            body: body,
            headers: authHeader(accessToken, idempotencyKey: UUID().uuidString)
        ))
    }

    private func authHeader(_ accessToken: String, idempotencyKey: String? = nil) -> [String: String] {
        var headers = ["Authorization": "Bearer \(accessToken)"]
        if let idempotencyKey { headers["Idempotency-Key"] = idempotencyKey }
        return headers
    }
}
