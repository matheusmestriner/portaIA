import Foundation

public struct StaffLoginResponse: Decodable {
    public let accessToken: String
    public let mustChangePassword: Bool
    public let csrfToken: String
}

/// POST /auth/change-password devolve só isto — sem `mustChangePassword`
/// (o chamador sabe que virou false só por ter tido sucesso na troca).
public struct StaffChangePasswordResponse: Decodable {
    public let accessToken: String
    public let csrfToken: String
}

public struct StaffRefreshResponse: Decodable {
    public let accessToken: String
    public let csrfToken: String
    public let mustChangePassword: Bool
}

public struct StaffMeResponse: Decodable {
    public let id: String
    public let email: String
    public let role: String
    public let resaleId: String?
    public let clientId: String?
    public let condominiumId: String?
    public let mustChangePassword: Bool
}

public struct ReportsOverview: Decodable {
    public let units: Int
    public let residents: Int
    public let vehicles: Int
    public let activeProviders: Int
    public let visitorsToday: Int
    public let pendingDeliveries: Int
    public let openOccurrences: Int
    public let keysCheckedOut: Int
    public let activePanicAlerts: Int
}

public struct UnitResponse: Decodable, Identifiable {
    public let id: String
    public let condominiumId: String
    public let identifier: String
    public let block: String?
    public let floor: String?
    public let isActive: Bool
}

public struct ExtensionResponse: Decodable, Identifiable {
    public let id: String
    public let unitId: String
    public let condominiumId: String
    public let number: String
    public let sipUsername: String
    public let isActive: Bool
}

public struct CallResponse: Decodable, Identifiable {
    public let id: String
    public let condominiumId: String
    public let externalCallId: String?
    public let callerType: String
    public let callerExtensionId: String?
    public let calleeType: String
    public let calleeExtensionId: String?
    public let status: String
    public let queuedAt: Date?
    public let ringingAt: Date?
    public let answeredAt: Date?
    public let endedAt: Date?
    public let endReason: String?
    public let createdAt: Date
}

public struct AnnouncementResponse: Decodable, Identifiable {
    public let id: String
    public let condominiumId: String
    public let title: String
    public let body: String
    public let createdBy: String
    public let createdAt: Date
    public let updatedAt: Date
}

public struct DeliveryResponse: Decodable, Identifiable {
    public let id: String
    public let unitId: String
    public let condominiumId: String
    public let residentId: String?
    public let description: String
    public let carrier: String?
    public let courierName: String?
    public let trackingCode: String?
    public let volumeCount: Int
    public let status: String
    public let pickedUpBy: String?
    public let pickupDocument: String?
    public let pickupCodeLast4: String?
    public let pickupCredentialExpiresAt: Date?
    public let receivedAt: Date
    public let collectedAt: Date?
}

/// `Identifiable` porque a tela de entregas apresenta a credencial via
/// `.sheet(item:)`, que exige isso. O id é o da própria entrega (não um
/// `UUID()` novo): um id gerado a cada decodificação faria a sheet reabrir
/// sozinha sempre que o valor fosse recriado.
public struct DeliveryCredentialResponse: Decodable, Identifiable {
    public let delivery: DeliveryResponse
    public let pickupCode: String
    public let qrToken: String
    public let qrPayload: String
    public let expiresAt: Date?

    public var id: String { delivery.id }
}

public struct PanicAlertResponse: Decodable, Identifiable {
    public let id: String
    public let condominiumId: String
    public let unitId: String?
    public let triggeredBy: String
    public let acknowledgedAt: Date?
    public let resolvedAt: Date?
    public let createdAt: Date
}
