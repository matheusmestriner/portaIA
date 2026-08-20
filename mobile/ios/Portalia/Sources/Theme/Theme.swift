import SwiftUI

/// Cores dinâmicas do sistema (se adaptam a claro/escuro sozinhas) mais um
/// acento próprio — evita depender de um catálogo de assets (.xcassets),
/// que não dá pra gerar corretamente sem o Xcode.
enum Theme {
    static let background = Color(.systemGroupedBackground)
    static let surface = Color(.secondarySystemGroupedBackground)
    static let textPrimary = Color(.label)
    static let textSecondary = Color(.secondaryLabel)
    static let textMuted = Color(.tertiaryLabel)
    static let border = Color(.separator)

    static let accent = Color(red: 0.22, green: 0.40, blue: 0.87)
    static let danger = Color(red: 0.85, green: 0.29, blue: 0.29)
    static let success = Color(red: 0.39, green: 0.60, blue: 0.13)
    static let warning = Color(red: 0.94, green: 0.62, blue: 0.15)

    static let cardRadius: CGFloat = 12
    static let controlRadius: CGFloat = 8
}

struct StatCard: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
            Text(value)
                .font(.title2.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

struct SectionCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            content
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var color: Color = Theme.accent
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(color.opacity(configuration.isPressed ? 0.8 : 1))
            .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
    }
}
