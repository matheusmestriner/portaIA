import Foundation

public struct APIRequest {
    public var path: String
    public var method: String = "GET"
    public var query: [String: String] = [:]
    public var body: Data? = nil
    public var headers: [String: String] = [:]

    public init(path: String, method: String = "GET", query: [String: String] = [:], body: Data? = nil, headers: [String: String] = [:]) {
        self.path = path
        self.method = method
        self.query = query
        self.body = body
        self.headers = headers
    }
}

/// Cliente HTTP fino sobre URLSession. `URLSession.shared`/uma sessão com
/// configuração `.default` (não `.ephemeral`) já persiste cookies via
/// `HTTPCookieStorage.shared` automaticamente — é assim que o refresh cookie
/// httpOnly do fluxo de equipe funciona neste cliente sem código extra: o
/// próprio URLSession reenvia o cookie sozinho nas próximas chamadas para o
/// mesmo host. O CSRF cookie não precisa ser lido do jar porque o backend já
/// devolve `csrfToken` em claro no corpo de login/refresh.
public final class HTTPClient {
    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(baseURL: URL = AppConfig.apiBaseURL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        self.session = URLSession(configuration: config)

        // Ver JSONCoding: a estratégia de data é a parte sutil (millis do
        // Node vs `.iso8601` do Foundation) e está isolada lá para poder ser
        // testada sem precisar de rede.
        self.decoder = JSONCoding.decoder()
        self.encoder = JSONCoding.encoder()
    }

    public func encode<T: Encodable>(_ value: T) throws -> Data {
        try encoder.encode(value)
    }

    /// Retorno `Void` para respostas 204/sem corpo.
    public func send(_ request: APIRequest) async throws {
        _ = try await sendRaw(request)
    }

    public func send<T: Decodable>(_ request: APIRequest) async throws -> T {
        let data = try await sendRaw(request)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    @discardableResult
    private func sendRaw(_ request: APIRequest) async throws -> Data {
        var components = URLComponents(url: baseURL.appendingPathComponent(request.path), resolvingAgainstBaseURL: false)!
        if !request.query.isEmpty {
            components.queryItems = request.query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else { throw APIError.unknown }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method
        urlRequest.httpBody = request.body
        if request.body != nil {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        for (key, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.network(error)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }

        if http.statusCode == 401 {
            throw APIError.unauthorized
        }
        if !(200..<300).contains(http.statusCode) {
            if let envelope = try? decoder.decode(ServerErrorEnvelope.self, from: data) {
                throw APIError.server(status: http.statusCode, code: envelope.error.code, message: envelope.error.message)
            }
            throw APIError.server(status: http.statusCode, code: nil, message: "Erro inesperado (\(http.statusCode))")
        }

        return data
    }
}
