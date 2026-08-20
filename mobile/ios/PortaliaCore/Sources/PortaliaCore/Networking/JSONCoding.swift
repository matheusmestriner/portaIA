import Foundation

public enum JSONCoding {
    /// `Date.prototype.toISOString()` no Node sempre emite milissegundos
    /// (`2026-08-16T16:20:05.529Z`), e a estratégia `.iso8601` padrão do
    /// Foundation **rejeita** frações de segundo — usá-la faria toda data
    /// vinda do backend falhar a decodificação. Tenta com frações primeiro e
    /// cai para sem frações (formato que um `DateTime` sem millis produziria).
    public static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let withoutFractional = ISO8601DateFormatter()
        withoutFractional.formatOptions = [.withInternetDateTime]

        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = withFractional.date(from: raw) ?? withoutFractional.date(from: raw) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Data ISO8601 inválida: \(raw)")
        }
        return decoder
    }

    public static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}
