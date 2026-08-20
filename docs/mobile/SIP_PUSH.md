# Interfone SIP e push em segundo plano — o que falta para ser real

Este documento existe porque tanto o backend quanto os dois apps mobile
deixam essa parte deliberadamente honesta: nada aqui finge estar
funcionando. Ver também `docs/V01_SCOPE.md` para o mesmo raciocínio aplicado
ao Asterisk no backend.

## O que já existe (pronto para plugar)

**Backend**
- `GET /resident/telephony/credentials` — devolve o `sipUsername`/`sipPassword`
  (decifrados) do ramal da unidade do morador, e `domain` a partir da env var
  `SIP_DOMAIN`. `configured:false` enquanto `SIP_DOMAIN` não estiver setada.
- `POST /telephony/events` — webhook HMAC que uma futura ponte AMI/ARI chamaria.
- `POST /telephony/calls` — a portaria já consegue originar uma chamada para
  o ramal de uma unidade (usado pelo app do porteiro na aba Interfone).

**Apps (iOS e Android)**
- `SIPService`/`SipService` — interface que a UI consome, com um stub que
  nunca finge estar registrado.
- iOS: `CallKitAdapter` (CXProvider real, framework do sistema) e
  `VoIPPushManager` (PKPushRegistry real, framework do sistema) — nenhum dos
  dois precisa de biblioteca externa para existir, só não têm hoje uma
  chamada de verdade pra reportar.
- Android: `TelecomAdapter`/`PortaliaConnectionService` (Telecom
  self-managed, API da plataforma) e `PortaliaMessagingService` (Firebase
  Cloud Messaging) — mesma ideia.

## O que falta, em ordem

1. **Um Asterisk real, acessível pela internet, com domínio e TLS.**
   Nenhum está conectado hoje (nem no backend, nem nos apps). Sem isso, nada
   do resto importa.
2. **Uma ponte AMI/ARI** entre o Asterisk e o backend, assinando os eventos
   com o mesmo HMAC que `POST /telephony/events` já espera.
3. **`SIP_DOMAIN` configurado** no backend (`backend/src/config/env.schema.ts`)
   apontando pro domínio real do Asterisk.
4. **Uma biblioteca SIP real nos apps**, implementando `SIPService`/`SipService`
   de verdade (registro, discagem, atender/recusar) — candidata recomendada:
   [Linphone SDK](https://www.linphone.org/technical-corner/liblinphone) (tem
   integração documentada com CallKit no iOS e com self-managed
   ConnectionService no Android). PJSIP é a alternativa mais baixo nível.
5. **iOS**: conta Apple Developer paga + certificado APNs de tipo VoIP
   (`aps-environment` já está declarado em `project.yml`, só falta o
   certificado real e o provisionamento).
6. **Android**: projeto Firebase real + `google-services.json` +
   `com.google.gms.google-services` aplicado em `app/build.gradle.kts` (hoje
   deliberadamente ausente pra não quebrar o build de quem ainda não tem
   Firebase configurado) + `PortaliaMessagingService` registrado no
   `AndroidManifest.xml`.
7. **Um jeito do backend saber pra qual push token mandar o aviso** — hoje
   não existe nenhum endpoint pra um dispositivo registrar seu token (APNs
   ou FCM) contra o próprio morador/unidade. É um módulo novo pequeno:
   `POST /resident/push-tokens` (ou similar) + uma tabela nova.
8. **A própria ponte AMI/ARI (ou um serviço intermediário) precisa disparar
   o push** quando uma chamada chega pro ramal de uma unidade — hoje
   `POST /telephony/events` só atualiza o estado da chamada no banco, não
   aciona nenhum push.

Nenhum item acima está bloqueado por decisão de arquitetura — é
configuração e credenciais que só o dono do produto pode prover (conta
Apple Developer, projeto Firebase, servidor Asterisk real).
