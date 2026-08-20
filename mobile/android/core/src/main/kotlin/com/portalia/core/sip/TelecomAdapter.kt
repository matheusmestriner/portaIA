package com.portalia.core.sip

import android.content.ComponentName
import android.content.Context
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import androidx.core.content.getSystemService

/**
 * Registra a conta "self-managed" do Telecom (Android O+, não exige o app
 * virar o discador padrão — o modo certo pra um app de VoIP) e conecta a
 * UI nativa de chamada do sistema ao SipService. Isto é real (telecom faz
 * parte da plataforma, sem dependência externa) — só não tem hoje o que
 * conectar porque SipServiceStub nunca produz uma chamada de verdade.
 */
object TelecomAdapter {
    private const val ACCOUNT_ID = "portalia_sip_account"

    fun phoneAccountHandle(context: Context): PhoneAccountHandle =
        PhoneAccountHandle(ComponentName(context, PortaliaConnectionService::class.java), ACCOUNT_ID)

    /** Devolve false quando o sistema recusa (MANAGE_OWN_CALLS ausente/revogada), em vez de derrubar o app. */
    fun registerPhoneAccount(context: Context): Boolean {
        val telecomManager = context.getSystemService<TelecomManager>() ?: return false
        val handle = phoneAccountHandle(context)
        val account = PhoneAccount.builder(handle, "Portalia")
            .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
            .build()
        return try {
            telecomManager.registerPhoneAccount(account)
            true
        } catch (e: SecurityException) {
            false
        }
    }

    fun reportIncomingCall(context: Context, callerDisplayName: String): Boolean {
        val telecomManager = context.getSystemService<TelecomManager>() ?: return false
        val extras = android.os.Bundle().apply {
            putString(EXTRA_CALLER_DISPLAY_NAME, callerDisplayName)
        }
        return try {
            telecomManager.addNewIncomingCall(phoneAccountHandle(context), extras)
            true
        } catch (e: SecurityException) {
            // A conta precisa estar registrada E o usuário ter concedido
            // MANAGE_OWN_CALLS; sem isso o Telecom recusa a chamada.
            false
        }
    }

    const val EXTRA_CALLER_DISPLAY_NAME = "com.portalia.EXTRA_CALLER_DISPLAY_NAME"
}

/**
 * `android:name` precisa ser registrado no AndroidManifest.xml do app com
 * `android.permission.BIND_TELECOM_CONNECTION_SERVICE` — não incluído no
 * manifest padrão deste scaffold porque ainda não há SipService real para
 * conectar aqui (ver docs/mobile/SIP_PUSH.md).
 */
class PortaliaConnectionService : android.telecom.ConnectionService() {
    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: android.telecom.ConnectionRequest?,
    ): android.telecom.Connection {
        val displayName = request?.extras?.getString(TelecomAdapter.EXTRA_CALLER_DISPLAY_NAME) ?: "Portaria"
        return PortaliaConnection(displayName)
    }
}

class PortaliaConnection(displayName: String) : android.telecom.Connection() {
    init {
        setCallerDisplayName(displayName, TelecomManager.PRESENTATION_ALLOWED)
        setConnectionProperties(PROPERTY_SELF_MANAGED)
        audioModeIsVoip = true
    }

    override fun onAnswer() {
        setActive()
        // A implementação real de SipService (quando existir) responde a
        // chamada de verdade aqui.
    }

    override fun onDisconnect() {
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
    }

    override fun onReject() {
        setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        destroy()
    }
}
