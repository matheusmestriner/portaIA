import Foundation

public struct ResidentLoginResponse: Decodable {
    public let accessToken: String
    public let refreshToken: String
    public let mustChangePassword: Bool
}

/// POST /resident-auth/change-password devolve só isto — sem `mustChangePassword`.
public struct ResidentChangePasswordResponse: Decodable {
    public let accessToken: String
    public let refreshToken: String
}

public struct ResidentRefreshResponse: Decodable {
    public let accessToken: String
    public let refreshToken: String
    public let mustChangePassword: Bool
}

public struct ResidentUnitSummary: Decodable {
    public let id: String
    public let identifier: String
    public let block: String?
}

public struct ResidentCondominiumSummary: Decodable {
    public let id: String
    public let name: String
}

public struct ResidentMeResponse: Decodable {
    public let id: String
    public let name: String
    public let email: String?
    public let phone: String?
    public let unit: ResidentUnitSummary
    public let condominium: ResidentCondominiumSummary
}

public struct ResidentDashboardResponse: Decodable {
    public let pendingDeliveries: Int
    public let visitorsThisMonth: Int
    public let avgVisitsPerWeek: Double?
    public let avgVisitDurationMinutes: Int?
}

public struct ResidentTelephonyCredentials: Decodable {
    public let configured: Bool
    public let sipUsername: String?
    public let sipPassword: String?
    public let domain: String?
}
