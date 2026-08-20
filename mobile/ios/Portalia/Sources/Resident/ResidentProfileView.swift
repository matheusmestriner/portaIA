import SwiftUI
import PortaliaCore

struct ResidentProfileView: View {
    @EnvironmentObject private var session: ResidentSession

    var body: some View {
        NavigationStack {
            List {
                if let me = session.me {
                    Section {
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Theme.accent.opacity(0.15))
                                .frame(width: 48, height: 48)
                                .overlay(Text(initials(me.name)).font(.headline).foregroundStyle(Theme.accent))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(me.name).font(.headline)
                                Text("\(me.condominium.name) · Apto \(me.unit.identifier)")
                                    .font(.footnote)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section {
                    LabeledContent("Email", value: session.me?.email ?? "—")
                    LabeledContent("Telefone", value: session.me?.phone ?? "—")
                }

                Section {
                    Button(role: .destructive) {
                        Task { await session.logout() }
                    } label: {
                        Text("Sair")
                    }
                }
            }
            .navigationTitle("Perfil")
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return String(letters).uppercased()
    }
}
