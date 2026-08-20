import SwiftUI
import PortaliaCore

struct DoormanProfileView: View {
    @EnvironmentObject private var session: StaffSession

    var body: some View {
        NavigationStack {
            List {
                if let me = session.me {
                    Section {
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Theme.accent.opacity(0.15))
                                .frame(width: 48, height: 48)
                                .overlay(Text(initials(me.email)).font(.headline).foregroundStyle(Theme.accent))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(me.email).font(.headline)
                                Text(roleLabel(me.role)).font(.footnote).foregroundStyle(Theme.textSecondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
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

    private func initials(_ email: String) -> String {
        String(email.prefix(2)).uppercased()
    }

    private func roleLabel(_ role: String) -> String {
        switch role {
        case "CONDO_OPERATOR": return "Porteiro"
        case "CONDO_MANAGER": return "Síndico / gestor"
        default: return role
        }
    }
}
