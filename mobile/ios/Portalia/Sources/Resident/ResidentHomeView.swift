import SwiftUI
import PortaliaCore

struct ResidentHomeView: View {
    @EnvironmentObject private var session: ResidentSession
    @State private var dashboard: ResidentDashboardResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Olá, \(session.me?.name.components(separatedBy: " ").first ?? "")")
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                        if let unit = session.me?.unit {
                            Text("\(unit.block.map { "Bloco \($0) · " } ?? "")Apto \(unit.identifier)")
                                .font(.headline)
                        }
                    }

                    if isLoading && dashboard == nil {
                        ProgressView().frame(maxWidth: .infinity)
                    } else if let dashboard {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            StatCard(label: "Entregas pendentes", value: "\(dashboard.pendingDeliveries)")
                            StatCard(label: "Visitantes no mês", value: "\(dashboard.visitorsThisMonth)")
                            StatCard(label: "Média de visitas", value: dashboard.avgVisitsPerWeek.map { "\($0)/sem" } ?? "—")
                            StatCard(label: "Tempo médio", value: "Não disponível")
                        }
                    } else if let errorMessage {
                        Text(errorMessage).font(.footnote).foregroundStyle(Theme.danger)
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Início")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            dashboard = try await session.authorized { token in try await session.api.dashboard(accessToken: token) }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Não foi possível carregar."
        }
    }
}
