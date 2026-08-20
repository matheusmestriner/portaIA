import Foundation
import CallKit
import Combine

/// Ponte entre SIPService e CallKit — isto é real (CallKit não precisa de
/// nenhuma biblioteca SIP externa para existir), só não tem hoje o que
/// reportar porque SIPServiceStub nunca produz uma chamada de verdade. Uma
/// implementação real de SIPService (Linphone SDK, PJSIP) chamando
/// `reportIncomingCall` aqui é o resto do fio que falta — nenhuma tela muda.
public final class CallKitAdapter: NSObject, CXProviderDelegate {
    private let provider: CXProvider
    private let callController = CXCallController()
    private let sip: SIPService
    private var cancellables = Set<AnyCancellable>()
    private var currentCallUUID: UUID?

    public init(sip: SIPService, appName: String = "Portalia") {
        self.sip = sip
        let configuration = CXProviderConfiguration()
        configuration.supportsVideo = false
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.generic]
        self.provider = CXProvider(configuration: configuration)
        super.init()
        provider.setDelegate(self, queue: nil)

        sip.activeCall
            .sink { [weak self] call in
                guard let self else { return }
                if let call, call.isIncoming {
                    self.reportIncomingCall(displayName: call.remoteDisplayName)
                } else if call == nil, let uuid = self.currentCallUUID {
                    self.provider.reportCall(with: uuid, endedAt: nil, reason: .remoteEnded)
                    self.currentCallUUID = nil
                }
            }
            .store(in: &cancellables)
    }

    /// Chamado por VoIPPushManager quando um push VoIP acorda o app — precisa
    /// reportar a chamada ao CallKit em até alguns milissegundos (exigência
    /// do sistema) mesmo antes do registro SIP terminar de confirmar os detalhes.
    public func reportIncomingCall(displayName: String) {
        let uuid = UUID()
        currentCallUUID = uuid
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: displayName)
        update.localizedCallerName = displayName
        update.hasVideo = false
        provider.reportNewIncomingCall(with: uuid, update: update) { _ in }
    }

    // MARK: - CXProviderDelegate

    public func providerDidReset(_ provider: CXProvider) {
        currentCallUUID = nil
    }

    // `[sip]` captura só o serviço, não `self`: dentro de uma closure
    // @escaping numa classe, referenciar `sip` implicitamente capturaria o
    // adapter inteiro (retain cycle em potencial), e o compilador exige que
    // a captura seja explícita.
    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        Task { [sip] in await sip.answerCall() }
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        Task { [sip] in await sip.endCall() }
        currentCallUUID = nil
        action.fulfill()
    }
}
