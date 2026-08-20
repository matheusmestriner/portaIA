import Foundation
import PushKit

/// Registra o dispositivo para push VoIP (PushKit) — é o que acorda o app em
/// segundo plano/tela bloqueada para tocar uma chamada (o requisito central
/// do pedido original: "tocar mesmo com o app fechado"). Real e funcional
/// hoje, mas o token gerado não serve pra nada ainda: só tem efeito depois
/// que (a) o app tiver o certificado APNs de VoIP de uma conta Apple
/// Developer real, e (b) o backend/Asterisk souber pra qual endpoint enviar
/// o push quando uma chamada chegar pro ramal daquele dispositivo — nenhuma
/// das duas pontas existe na V01 (ver docs/mobile/SIP_PUSH.md).
public final class VoIPPushManager: NSObject, PKPushRegistryDelegate {
    public typealias TokenHandler = (String) -> Void
    public typealias IncomingCallHandler = (_ callerDisplayName: String) -> Void

    private let registry = PKPushRegistry(queue: .main)
    private let onToken: TokenHandler
    private let onIncomingCall: IncomingCallHandler

    public init(onToken: @escaping TokenHandler, onIncomingCall: @escaping IncomingCallHandler) {
        self.onToken = onToken
        self.onIncomingCall = onIncomingCall
        super.init()
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
    }

    public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        onToken(token)
    }

    public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }
        // Formato do payload é definido por quem envia o push — a futura
        // ponte AMI/ARI (mesmo espírito de POST /telephony/events no
        // backend). "callerDisplayName" é um nome de campo provisório.
        let displayName = payload.dictionaryPayload["callerDisplayName"] as? String ?? "Portaria"
        onIncomingCall(displayName)
        completion()
    }
}
