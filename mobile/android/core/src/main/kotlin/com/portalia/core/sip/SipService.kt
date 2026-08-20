package com.portalia.core.sip

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

sealed class SipRegistrationState {
    object NotConfigured : SipRegistrationState()
    object Registering : SipRegistrationState()
    object Registered : SipRegistrationState()
    data class Failed(val reason: String) : SipRegistrationState()
}

data class SipCallInfo(val remoteDisplayName: String, val isIncoming: Boolean)

/**
 * Interface que a UI (telas de Interfone) consome — não amarra a nenhuma
 * biblioteca SIP específica. `SipServiceStub` é a única implementação hoje:
 * nenhum Asterisk real está conectado na V01 (mesma ressalva do backend e
 * do lado iOS), então o app nunca finge estar registrado.
 */
interface SipService {
    val registrationState: StateFlow<SipRegistrationState>
    val activeCall: StateFlow<SipCallInfo?>

    suspend fun register(username: String, password: String, domain: String)
    suspend fun unregister()
    suspend fun placeCall(destination: String, displayName: String)
    suspend fun answerCall()
    suspend fun endCall()
    suspend fun declineCall()
}

class SipServiceStub : SipService {
    private val _registrationState = MutableStateFlow<SipRegistrationState>(SipRegistrationState.NotConfigured)
    override val registrationState: StateFlow<SipRegistrationState> = _registrationState

    private val _activeCall = MutableStateFlow<SipCallInfo?>(null)
    override val activeCall: StateFlow<SipCallInfo?> = _activeCall

    override suspend fun register(username: String, password: String, domain: String) {
        _registrationState.value = SipRegistrationState.Failed("Nenhum servidor Asterisk configurado nesta instalação.")
    }

    override suspend fun unregister() {
        _registrationState.value = SipRegistrationState.NotConfigured
    }

    override suspend fun placeCall(destination: String, displayName: String) {
        // Intencionalmente no-op: sem registro SIP real, não há nada para discar.
    }

    override suspend fun answerCall() {}
    override suspend fun endCall() { _activeCall.value = null }
    override suspend fun declineCall() { _activeCall.value = null }
}
