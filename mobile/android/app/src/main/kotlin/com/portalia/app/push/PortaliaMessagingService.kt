package com.portalia.app.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.portalia.core.sip.TelecomAdapter

/**
 * Recebe o push de alta prioridade que acorda o app com a tela desligada —
 * o equivalente Android do VoIPPushManager (PushKit) do iOS. Real e
 * funcional como classe, mas inerte até três coisas existirem: um projeto
 * Firebase de verdade (`google-services.json`, ver app/build.gradle.kts),
 * este serviço registrado no AndroidManifest.xml com um `<intent-filter>`
 * para `com.google.firebase.MESSAGING_EVENT`, e um SipService real (não o
 * stub) para efetivamente atender a chamada depois que o Telecom relatar.
 * Ver docs/mobile/SIP_PUSH.md.
 */
class PortaliaMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val callerDisplayName = message.data["callerDisplayName"] ?: "Portaria"
        val isIncomingCall = message.data["type"] == "incoming_call"
        if (isIncomingCall) {
            TelecomAdapter.reportIncomingCall(applicationContext, callerDisplayName)
        }
    }

    override fun onNewToken(token: String) {
        // A implementação real envia este token pro backend associá-lo ao
        // ramal/unidade do morador — endpoint ainda não existe (backend só
        // tem GET /resident/telephony/credentials hoje, sem registro de
        // device token). Ver docs/mobile/SIP_PUSH.md.
    }
}
