import SwiftUI
import PortaliaCore

struct ResidentIntercomView: View {
    @EnvironmentObject private var session: ResidentSession
    @State private var credentials: ResidentTelephonyCredentials?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Circle()
                        .fill(Theme.accent.opacity(0.15))
                        .frame(width: 84, height: 84)
                        .overlay(Image(systemName: "building.2.fill").font(.system(size: 32)).foregroundStyle(Theme.accent))
                        .padding(.top, 12)

                    Text("Portaria")
                        .font(.title3.weight(.semibold))

                    if isLoading {
                        ProgressView()
                    } else if let credentials, credentials.configured {
                        Text("Ramal \(credentials.sipUsername ?? "—") · \(credentials.domain ?? "")")
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                        Button("Chamar portaria") {}
                            .buttonStyle(PrimaryButtonStyle())
                    } else {
                        VStack(spacing: 8) {
                            Badge(text: "SIP não configurado", color: Theme.warning)
                            Text("O interfone deste condomínio ainda não foi ativado pelo administrador. Assim que o servidor SIP for configurado, as chamadas passam a funcionar aqui automaticamente.")
                                .font(.footnote)
                                .foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(16)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .background(Theme.background)
            .navigationTitle("Interfone")
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            credentials = try await session.authorized { token in try await session.api.telephonyCredentials(accessToken: token) }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
