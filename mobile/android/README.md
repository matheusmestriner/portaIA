# Portalia Android

App nativo (Kotlin, Jetpack Compose, minSdk 26) com um único módulo `app`
mostrando a UI de morador ou de porteiro dependendo do papel da conta
autenticada, mais um módulo `core` compartilhado (rede, autenticação,
modelos, interface de SIP).

## Estrutura

- `core/` — módulo Android library: `HttpClient` (OkHttp + kotlinx.serialization),
  `StaffSession`/`ResidentSession` (autenticação em paralelo, mesma separação
  do backend em `backend/src/resident-auth`), `SipService` (stub — sem
  Asterisk real conectado ainda).
- `app/` — o app em si (telas Jetpack Compose), consumindo `core`.

## Build (Android Studio ou linha de comando)

A versão do Gradle já está fixada em `gradle/wrapper/gradle-wrapper.properties`
(8.7, exigida pelo AGP 8.5.x), mas os arquivos `gradlew`/`gradlew.bat` e o
`gradle-wrapper.jar` **não estão versionados** (binário/scripts que não dá
para gerar sem uma instalação de Gradle). Duas formas de resolver:

- **Android Studio**: abra a pasta `mobile/android`; ele reconhece o
  `gradle-wrapper.properties` e completa o wrapper no primeiro sync.
- **Linha de comando**: com Gradle instalado localmente, rode `gradle wrapper`
  uma vez dentro de `mobile/android` — ele gera os arquivos que faltam
  respeitando a versão já fixada. Depois disso, `./gradlew assembleDebug`.

Rode no emulador (`Run ▸ app`). Para rodar num aparelho físico, troque
`AppConfig.API_BASE_URL` (`core/src/main/kotlin/com/portalia/core/config/AppConfig.kt`)
de `http://10.0.2.2:3101/api/v1/` (alias do emulador pro localhost da
máquina host) para o IP da máquina que roda o backend na mesma rede.

## Backend

```bash
cd backend
npm run start:dev
```

Login de teste: veja `backend/.env` (`SUPER_ADMIN_BOOTSTRAP_EMAIL/PASSWORD`)
para a conta de equipe, ou cadastre um morador pela tela "Novo morador" do
frontend web (`frontend/`) — a senha temporária aparece uma única vez.

## O que ainda não funciona de verdade

- **Interfone SIP**: `SipServiceStub` nunca registra de verdade — mostra
  "SIP não configurado" honestamente porque nenhum Asterisk real está
  conectado nesta fase (mesma ressalva do backend e do lado iOS). Ver
  `docs/mobile/SIP_PUSH.md`.
- **Ícone do app**: nenhum ícone/launcher foi gerado (precisa de assets de
  imagem que não dá pra criar sem ferramenta gráfica) — o Android usa um
  ícone padrão até alguém adicionar um real em `app/src/main/res/mipmap-*`.
- **Este código nunca foi compilado**: escrito sem acesso a Android
  Studio/SDK (ambiente de desenvolvimento não tinha Java/Gradle instalados).
  Espere precisar de pequenos ajustes na primeira build real.
