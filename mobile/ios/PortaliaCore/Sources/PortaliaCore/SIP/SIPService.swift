import Foundation
import Combine

public enum SIPRegistrationState: Equatable {
    case notConfigured
    case registering
    case registered
    case failed(String)
}

public struct SIPCallInfo: Identifiable, Equatable {
    public let id = UUID()
    public let remoteDisplayName: String
    public let isIncoming: Bool
}

/// Interface que a UI (telas de Interfone) consome — não amarra a nenhuma
/// biblioteca SIP específica. `SIPServiceStub` é a única implementação hoje:
/// nenhum Asterisk real está conectado na V01 (mesma ressalva do backend,
/// ver docs/V01_SCOPE.md), então o app nunca finge estar registrado. Quando
/// houver domínio SIP real, uma implementação real (Linphone SDK + CallKit)
/// entra aqui atrás da mesma interface — nenhuma tela muda.
public protocol SIPService: AnyObject {
    var registrationState: CurrentValueSubject<SIPRegistrationState, Never> { get }
    var activeCall: CurrentValueSubject<SIPCallInfo?, Never> { get }

    func register(username: String, password: String, domain: String) async
    func unregister() async
    func placeCall(to destination: String, displayName: String) async
    func answerCall() async
    func endCall() async
    func declineCall() async
}

/// Implementação honesta: sem SIP_DOMAIN configurado no backend (ver
/// GET /resident/telephony/credentials `configured:false`), a tela de
/// Interfone nunca deve nem chamar `register` — mas se chamar, isto garante
/// que o estado nunca finge "registered" sem um domínio real.
public final class SIPServiceStub: SIPService {
    public let registrationState = CurrentValueSubject<SIPRegistrationState, Never>(.notConfigured)
    public let activeCall = CurrentValueSubject<SIPCallInfo?, Never>(nil)

    public init() {}

    public func register(username: String, password: String, domain: String) async {
        registrationState.send(.failed("Nenhum servidor Asterisk configurado nesta instalação."))
    }

    public func unregister() async {
        registrationState.send(.notConfigured)
    }

    public func placeCall(to destination: String, displayName: String) async {
        // Intencionalmente no-op: sem registro SIP real, não há nada para discar.
    }

    public func answerCall() async {}
    public func endCall() async { activeCall.send(nil) }
    public func declineCall() async { activeCall.send(nil) }
}
