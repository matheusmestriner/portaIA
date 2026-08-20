import Foundation
import Security

/// Wrapper fino sobre o Keychain (kSecClassGenericPassword) — usado para
/// persistir o refresh token do morador (o app precisa reapresentá-lo
/// explicitamente, ver ResidentSession) e, opcionalmente, o access token de
/// equipe entre lançamentos do app (o access token de equipe normalmente
/// vive só em memória, mas persistir permite reabrir o app sem exigir login
/// de novo enquanto o refresh cookie do URLSession ainda for válido).
public final class KeychainStore {
    public static let shared = KeychainStore()
    private init() {}

    public func set(_ value: String, for key: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    public func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func remove(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

public enum KeychainKey {
    public static let residentRefreshToken = "portalia.resident.refreshToken"
    public static let residentAccessToken = "portalia.resident.accessToken"
    public static let staffAccessToken = "portalia.staff.accessToken"
    public static let staffCsrfToken = "portalia.staff.csrfToken"
}
