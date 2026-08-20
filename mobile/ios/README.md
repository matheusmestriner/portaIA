# Portalia iOS

App nativo (SwiftUI, iOS 16+) com um único alvo mostrando a UI de morador ou
de porteiro dependendo do papel da conta autenticada. Depende do backend em
`backend/` (NestJS) rodando localmente.

## Estrutura

- `PortaliaCore/` — Swift Package local: rede, autenticação (equipe e
  morador, em paralelo — ver `backend/src/resident-auth`), modelos, e a
  interface de SIP (`SIPServiceStub`, sem Asterisk real conectado ainda).
- `Portalia/` — o app em si (telas SwiftUI), consumindo `PortaliaCore`.
- `project.yml` — spec do [XcodeGen](https://github.com/yonaskolb/XcodeGen)
  que gera o `.xcodeproj` (não versionado — gerado a partir daqui).

## Build (precisa de um Mac com Xcode)

```bash
brew install xcodegen
cd mobile/ios
xcodegen generate
open Portalia.xcodeproj
```

Rode no simulador (`⌘R`). Para rodar num iPhone físico, troque
`AppConfig.apiBaseURL` (`PortaliaCore/Sources/PortaliaCore/Config/AppConfig.swift`)
de `http://localhost:3101/api/v1` para o IP da máquina que roda o backend na
mesma rede — `localhost` num dispositivo físico aponta pro próprio aparelho,
não pro seu computador.

## Backend

```bash
cd backend
npm run start:dev
```

Login de teste: veja `backend/.env` (`SUPER_ADMIN_BOOTSTRAP_EMAIL/PASSWORD`)
para a conta de equipe, ou cadastre um morador pela tela "Novo morador" do
frontend web (`frontend/`) — a senha temporária aparece uma única vez.

## O que ainda não funciona de verdade

- **Interfone SIP**: `SIPServiceStub` nunca registra de verdade — mostra
  "SIP não configurado" honestamente porque nenhum Asterisk real está
  conectado nesta fase (mesma ressalva do backend). Ver
  `docs/mobile/SIP_PUSH.md` para o que falta plugar.
- **Este código nunca foi compilado**: escrito sem acesso a Xcode (ambiente
  de desenvolvimento é Windows). Espere precisar de pequenos ajustes na
  primeira build real.
