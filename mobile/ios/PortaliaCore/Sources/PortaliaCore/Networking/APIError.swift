import Foundation

public enum APIError: Error, LocalizedError {
    case network(Error)
    case decoding(Error)
    case server(status: Int, code: String?, message: String)
    case unauthorized
    case unknown

    public var errorDescription: String? {
        switch self {
        case .network:
            return "Não foi possível conectar ao servidor."
        case .decoding:
            return "Resposta inesperada do servidor."
        case .server(_, _, let message):
            return message
        case .unauthorized:
            return "Sessão expirada. Entre novamente."
        case .unknown:
            return "Algo deu errado. Tente novamente."
        }
    }
}

/// Espelha o envelope de erro padrão do backend: `{error: {code, message, correlationId, details}}`.
struct ServerErrorEnvelope: Decodable {
    struct Body: Decodable {
        let code: String?
        let message: String
    }
    let error: Body
}
