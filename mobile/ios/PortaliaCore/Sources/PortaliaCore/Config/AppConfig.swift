import Foundation

/// Aponta para o backend Portalia. Troque `baseURL` por build configuration
/// (dev/staging/prod) quando houver múltiplos ambientes reais — hoje só existe
/// o dev local, então fica hardcoded num único lugar.
public enum AppConfig {
    public static let apiBaseURL = URL(string: "http://localhost:3101/api/v1")!
}
