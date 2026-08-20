import Foundation

/// Sessão do app do porteiro (equipe). Espelha o session-store do frontend
/// web: access token só em memória (Published, nunca persistido em claro —
/// só o refresh cookie httpOnly persiste, gerenciado pelo próprio
/// URLSession), com uma tentativa silenciosa de refresh ao abrir o app.
@MainActor
public final class StaffSession: ObservableObject {
    @Published public private(set) var me: StaffMeResponse?
    @Published public private(set) var mustChangePassword = false
    @Published public private(set) var isBootstrapping = true
    @Published public var errorMessage: String?

    public let api: StaffAPI
    private var accessToken: String?
    private var csrfToken: String?
    private var inFlightRefresh: Task<Void, Never>?

    public var isAuthenticated: Bool { accessToken != nil && me != nil }
    public var condominiumId: String? { me?.condominiumId }

    public init(api: StaffAPI = StaffAPI(http: HTTPClient())) {
        self.api = api
    }

    public func bootstrap() async {
        await refresh()
        isBootstrapping = false
    }

    public func login(email: String, password: String) async -> Bool {
        errorMessage = nil
        do {
            let result = try await api.login(email: email, password: password)
            accessToken = result.accessToken
            csrfToken = result.csrfToken
            mustChangePassword = result.mustChangePassword
            await loadMe()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Não foi possível entrar."
            return false
        }
    }

    public func logout() async {
        if let accessToken, let csrfToken {
            try? await api.logout(accessToken: accessToken, csrfToken: csrfToken)
        }
        self.accessToken = nil
        self.csrfToken = nil
        self.me = nil
        self.mustChangePassword = false
    }

    public func changePassword(current: String, new: String) async -> Bool {
        guard let accessToken else { return false }
        errorMessage = nil
        do {
            let result = try await api.changePassword(accessToken: accessToken, current: current, new: new)
            self.accessToken = result.accessToken
            self.csrfToken = result.csrfToken
            self.mustChangePassword = false
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Não foi possível trocar a senha."
            return false
        }
    }

    /// Executa uma chamada autenticada; numa resposta 401, tenta um refresh
    /// (compartilhado entre chamadores concorrentes, mesmo desenho do
    /// `inFlightRefresh` do frontend web) e tenta de novo uma única vez.
    public func authorized<T>(_ call: (String) async throws -> T) async throws -> T {
        guard let token = accessToken else { throw APIError.unauthorized }
        do {
            return try await call(token)
        } catch APIError.unauthorized {
            await refresh()
            guard let retryToken = accessToken else { throw APIError.unauthorized }
            return try await call(retryToken)
        }
    }

    private func refresh() async {
        if let inFlightRefresh {
            await inFlightRefresh.value
            return
        }
        // Tipo anotado explicitamente: `self?.performRefresh()` devolve
        // `Void?` (opcional encadeado), então sem a anotação o Swift infere
        // `Task<Void?, Never>`, que não casa com `Task<Void, Never>?`.
        let task: Task<Void, Never> = Task { [weak self] in
            await self?.performRefresh()
        }
        inFlightRefresh = task
        await task.value
        inFlightRefresh = nil
    }

    /// Se o app acabou de abrir (relançado depois de fechado), ainda não há
    /// `csrfToken` em memória — mas o cookie CSRF (não-httpOnly, de propósito)
    /// pode ter sobrevivido no `HTTPCookieStorage` persistente do URLSession
    /// de uma sessão anterior. Lê de lá como fallback só nesse caso.
    private func performRefresh() async {
        let tokenToUse = csrfToken ?? readCsrfCookieFromStorage()
        do {
            let result = try await api.refresh(csrfToken: tokenToUse ?? "")
            self.accessToken = result.accessToken
            self.csrfToken = result.csrfToken
            self.mustChangePassword = result.mustChangePassword
            if me == nil { await loadMe() }
        } catch {
            self.accessToken = nil
            self.csrfToken = nil
            self.me = nil
        }
    }

    private func readCsrfCookieFromStorage() -> String? {
        // O backend grava o cookie com `Path=/api/v1/auth`, e o casamento de
        // path de cookie exige que o path do cookie seja prefixo do path
        // consultado — procurar na base `/api/v1` nunca encontraria nada.
        let authURL = AppConfig.apiBaseURL.appendingPathComponent("auth")
        return HTTPCookieStorage.shared.cookies(for: authURL)?
            .first(where: { $0.name == "portalia_csrf" })?.value
    }

    private func loadMe() async {
        guard let accessToken else { return }
        do {
            me = try await api.me(accessToken: accessToken)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
