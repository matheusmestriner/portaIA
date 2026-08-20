import XCTest
@testable import PortaliaCore

/**
 Decodifica exatamente os JSONs que o backend produz hoje (copiados dos
 mappers reais em `backend/src/**/response.mappers.ts`). É a defesa contra
 desalinhamento de contrato — a classe de bug que já apareceu duas vezes
 nestes apps (a resposta de change-password não traz `mustChangePassword`,
 ao contrário do que o modelo assumia originalmente).
 */
final class DecodingContractTests: XCTestCase {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try JSONCoding.decoder().decode(type, from: Data(json.utf8))
    }

    // MARK: - Datas

    func testDecodesNodeISOStringWithMilliseconds() throws {
        // `new Date().toISOString()` no Node SEMPRE inclui milissegundos.
        struct Box: Decodable { let at: Date }
        let box = try decode(Box.self, #"{"at":"2026-08-16T16:20:05.529Z"}"#)
        XCTAssertEqual(box.at.timeIntervalSince1970, 1_776_356_405.529, accuracy: 0.001)
    }

    func testDecodesISOStringWithoutMilliseconds() throws {
        struct Box: Decodable { let at: Date }
        let box = try decode(Box.self, #"{"at":"2026-08-16T16:20:05Z"}"#)
        XCTAssertEqual(box.at.timeIntervalSince1970, 1_776_356_405, accuracy: 0.001)
    }

    func testRejectsGarbageDate() {
        struct Box: Decodable { let at: Date }
        XCTAssertThrowsError(try decode(Box.self, #"{"at":"nao-e-uma-data"}"#))
    }

    // MARK: - Auth (equipe)

    func testDecodesStaffLoginResponse() throws {
        let json = #"{"accessToken":"jwt-aqui","mustChangePassword":true,"csrfToken":"abc123"}"#
        let result = try decode(StaffLoginResponse.self, json)
        XCTAssertTrue(result.mustChangePassword)
        XCTAssertEqual(result.csrfToken, "abc123")
    }

    /// POST /auth/change-password devolve SÓ accessToken + csrfToken.
    func testDecodesStaffChangePasswordResponseWithoutMustChangePassword() throws {
        let json = #"{"accessToken":"novo-jwt","csrfToken":"novo-csrf"}"#
        let result = try decode(StaffChangePasswordResponse.self, json)
        XCTAssertEqual(result.accessToken, "novo-jwt")
    }

    func testDecodesStaffMeResponseWithNullTenantIds() throws {
        // Um SUPER_ADMIN não tem nenhum id de tenant preenchido.
        let json = """
        {"id":"u1","email":"admin@portalia.local","role":"SUPER_ADMIN",
         "resaleId":null,"clientId":null,"condominiumId":null,"mustChangePassword":false}
        """
        let result = try decode(StaffMeResponse.self, json)
        XCTAssertNil(result.condominiumId)
        XCTAssertEqual(result.role, "SUPER_ADMIN")
    }

    // MARK: - Auth (morador)

    func testDecodesResidentLoginResponse() throws {
        let json = #"{"accessToken":"jwt","refreshToken":"opaco","mustChangePassword":false}"#
        let result = try decode(ResidentLoginResponse.self, json)
        XCTAssertEqual(result.refreshToken, "opaco")
    }

    /// POST /resident-auth/change-password devolve SÓ accessToken + refreshToken.
    func testDecodesResidentChangePasswordResponseWithoutMustChangePassword() throws {
        let json = #"{"accessToken":"novo-jwt","refreshToken":"novo-opaco"}"#
        let result = try decode(ResidentChangePasswordResponse.self, json)
        XCTAssertEqual(result.refreshToken, "novo-opaco")
    }

    func testDecodesResidentMeResponse() throws {
        let json = """
        {"id":"r1","name":"Ana Ativa","email":"ana@example.com","phone":null,
         "unit":{"id":"u1","identifier":"A-101","block":null},
         "condominium":{"id":"c1","name":"Condo Teste"}}
        """
        let result = try decode(ResidentMeResponse.self, json)
        XCTAssertEqual(result.unit.identifier, "A-101")
        XCTAssertEqual(result.condominium.name, "Condo Teste")
        XCTAssertNil(result.phone)
    }

    /// `avgVisitDurationMinutes` é sempre null na V01 (o schema não registra
    /// entrada/saída real do visitante) — o modelo precisa aceitar isso.
    func testDecodesResidentDashboardWithNullAverages() throws {
        let json = #"{"pendingDeliveries":1,"visitorsThisMonth":0,"avgVisitsPerWeek":0,"avgVisitDurationMinutes":null}"#
        let result = try decode(ResidentDashboardResponse.self, json)
        XCTAssertEqual(result.pendingDeliveries, 1)
        XCTAssertNil(result.avgVisitDurationMinutes)
    }

    func testDecodesTelephonyCredentialsWhenNotConfigured() throws {
        let json = #"{"configured":false,"sipUsername":null,"sipPassword":null,"domain":null}"#
        let result = try decode(ResidentTelephonyCredentials.self, json)
        XCTAssertFalse(result.configured)
        XCTAssertNil(result.domain)
    }

    // MARK: - Entregas

    func testDecodesDeliveryResponse() throws {
        let json = """
        {"id":"d1","unitId":"u1","condominiumId":"c1","residentId":null,
         "description":"Encomenda A","carrier":null,"courierName":null,"trackingCode":null,
         "volumeCount":1,"status":"PENDING","receiptPhotoId":null,"pickupPhotoId":null,
         "pickedUpBy":null,"pickupDocument":null,"pickupCodeLast4":"4821",
         "pickupCredentialExpiresAt":"2026-08-18T16:20:05.529Z",
         "receivedAt":"2026-08-16T16:20:05.529Z","collectedAt":null}
        """
        let result = try decode(DeliveryResponse.self, json)
        XCTAssertEqual(result.status, "PENDING")
        XCTAssertEqual(result.pickupCodeLast4, "4821")
        XCTAssertNil(result.collectedAt)
    }

    /// A sheet de credencial usa `.sheet(item:)`, que exige Identifiable — e
    /// o id precisa ser estável entre decodificações, senão a sheet reabre sozinha.
    func testDeliveryCredentialIdIsStableAndMatchesTheDelivery() throws {
        let json = """
        {"delivery":{"id":"d1","unitId":"u1","condominiumId":"c1","residentId":null,
          "description":"Encomenda A","carrier":null,"courierName":null,"trackingCode":null,
          "volumeCount":1,"status":"PENDING","receiptPhotoId":null,"pickupPhotoId":null,
          "pickedUpBy":null,"pickupDocument":null,"pickupCodeLast4":"4821",
          "pickupCredentialExpiresAt":null,
          "receivedAt":"2026-08-16T16:20:05.529Z","collectedAt":null},
         "pickupCode":"124821","qrToken":"tok","qrPayload":"portalia://retirada/d1?token=tok",
         "expiresAt":null}
        """
        let first = try decode(DeliveryCredentialResponse.self, json)
        let second = try decode(DeliveryCredentialResponse.self, json)
        XCTAssertEqual(first.id, "d1")
        XCTAssertEqual(first.id, second.id)
    }

    func testDecodesDeliveryCredentialResponse() throws {
        let json = """
        {"delivery":{"id":"d1","unitId":"u1","condominiumId":"c1","residentId":null,
          "description":"Encomenda A","carrier":null,"courierName":null,"trackingCode":null,
          "volumeCount":1,"status":"PENDING","receiptPhotoId":null,"pickupPhotoId":null,
          "pickedUpBy":null,"pickupDocument":null,"pickupCodeLast4":"4821",
          "pickupCredentialExpiresAt":null,
          "receivedAt":"2026-08-16T16:20:05.529Z","collectedAt":null},
         "pickupCode":"124821","qrToken":"tok","qrPayload":"portalia://retirada/d1?token=tok",
         "expiresAt":"2026-08-18T16:20:05.529Z"}
        """
        let result = try decode(DeliveryCredentialResponse.self, json)
        XCTAssertEqual(result.pickupCode, "124821")
        XCTAssertTrue(result.qrPayload.hasPrefix("portalia://retirada/"))
    }

    // MARK: - Paginação

    func testDecodesPaginatedEnvelope() throws {
        let json = """
        {"items":[{"id":"a1","condominiumId":"c1","title":"Aviso geral","body":"Corpo",
                   "createdBy":"seed","createdAt":"2026-08-16T16:20:05.529Z",
                   "updatedAt":"2026-08-16T16:20:05.529Z"}],
         "page":1,"pageSize":20,"total":1}
        """
        let result = try decode(Paginated<AnnouncementResponse>.self, json)
        XCTAssertEqual(result.total, 1)
        XCTAssertEqual(result.items.first?.title, "Aviso geral")
    }

    // MARK: - Envelope de erro

    func testDecodesServerErrorEnvelope() throws {
        let json = #"{"error":{"code":"VALIDATION_ERROR","message":"Informe unitId ou condominiumId","correlationId":"x"}}"#
        let result = try decode(ServerErrorEnvelope.self, json)
        XCTAssertEqual(result.error.message, "Informe unitId ou condominiumId")
    }
}
