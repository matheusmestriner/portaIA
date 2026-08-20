import Foundation

/// Sessão do app do morador. Ao contrário da equipe, o refresh token não vem
/// de um cookie — o backend devolve o valor no corpo e o app guarda no
/// Keychain, reapresentando explicitamente em `POST /resident-auth/refresh`.
/// Isso é o que permite reabrir o app depois de fechado sem precisar logar
/// de novo (o Keychain sobrevive o processo morrer, memória não).
@MainActor
public final class ResidentSession: ObservableObject {
    @Published public private(set) var me: ResidentMeResponse?
    @Published public private(set) var mustChangePassword = false
    @Published public private(set) var isBootstrapping = true
    @Published public var errorMessage: String?

    public let api: ResidentAPI
    private let keychain: KeychainStore
    private var accessToken: String?
    private var inFlightRefresh: Task<Void, Never>?

    public var isAuthenticated: Bool { accessToken != nil && me != nil }

    public init(api: ResidentAPI = ResidentAPI(http: HTTPClient()), keychain: KeychainStore = .shared) {
        self.api = api
        self.keychain = keychain
    }

    public func bootstrap() async {
        if keychain.get(KeychainKey.residentRefreshToken) != nil {
            await refresh()
        }
        isBootstrapping = false
    }

    public func login(email: String, password: String) async -> Bool {
        errorMessage = nil
        do {
            let result = try await api.login(email: email, password: password)
            accessToken = result.accessToken
            keychain.set(result.refreshToken, for: KeychainKey.residentRefreshToken)
            mustChangePassword = result.mustChangePassword
            await loadMe()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Não foi possível entrar."
            return false
        }
    }

    public func logout() async {
        if let accessToken {
            try? await api.logout(accessToken: accessToken)
        }
        keychain.remove(KeychainKey.residentRefreshToken)
        self.accessToken = nil
        self.me = nil
        self.mustChangePassword = false
    }

    public func changePassword(current: String, new: String) async -> Bool {
        guard let accessToken else { return false }
        errorMessage = nil
        do {
            let result = try await api.changePassword(accessToken: accessToken, current: current, new: new)
            self.accessToken = result.accessToken
            keychain.set(result.refreshToken, for: KeychainKey.residentRefreshToken)
            self.mustChangePassword = false
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Não foi possível trocar a senha."
            return false
        }
    }

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

    /// Exposto para telas de SIP que precisam do access token bruto (ex.: chamar
    /// GET /resident/telephony/credentials fora do wrapper `authorized`).
    public func currentAccessToken() -> String? { accessToken }

    private func refresh() async {
        if let inFlightRefresh {
            await inFlightRefresh.value
            return
        }
        // Ver a mesma anotação em StaffSession: sem ela o Swift infere
        // `Task<Void?, Never>` por causa do opcional encadeado em `self?`.
        let task: Task<Void, Never> = Task { [weak self] in await self?.performRefresh() }
        inFlightRefresh = task
        await task.value
        inFlightRefresh = nil
    }

    private func performRefresh() async {
        guard let refreshToken = keychain.get(KeychainKey.residentRefreshToken) else {
            accessToken = nil
            me = nil
            return
        }
        do {
            let result = try await api.refresh(refreshToken: refreshToken)
            self.accessToken = result.accessToken
            keychain.set(result.refreshToken, for: KeychainKey.residentRefreshToken)
            self.mustChangePassword = result.mustChangePassword
            if me == nil { await loadMe() }
        } catch {
            keychain.remove(KeychainKey.residentRefreshToken)
            self.accessToken = nil
            self.me = nil
        }
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
