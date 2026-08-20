import SwiftUI
import PortaliaCore

struct DoormanHomeView: View {
    @EnvironmentObject private var session: StaffSession
    @State private var overview: ReportsOverview?
    @State private var recentCalls: [CallResponse] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showPanicConfirm = false
    @State private var isTriggeringPanic = false
    @State private var panicConfirmedMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Portaria").font(.footnote).foregroundStyle(Theme.textSecondary)

                    Button {
                        showPanicConfirm = true
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 26))
                            Text("Botão de pânico").font(.subheadline.weight(.semibold))
                            Text("Aciona emergência para síndico e monitoramento")
                                .font(.caption)
                                .multilineTextAlignment(.center)
                                .opacity(0.9)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                    }
                    .buttonStyle(PrimaryButtonStyle(color: Theme.danger))
                    .disabled(isTriggeringPanic)

                    if let panicConfirmedMessage {
                        Text(panicConfirmedMessage).font(.footnote).foregroundStyle(Theme.success)
                    }

                    if let overview {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            StatCard(label: "Entregas pendentes", value: "\(overview.pendingDeliveries)")
                            StatCard(label: "Alertas de pânico ativos", value: "\(overview.activePanicAlerts)")
                        }
                    }

                    Text("Chamadas recentes").font(.subheadline.weight(.semibold))
                    if recentCalls.isEmpty && !isLoading {
                        Text("Nenhuma chamada recente.").font(.footnote).foregroundStyle(Theme.textMuted)
                    }
                    ForEach(recentCalls) { call in
                        HStack {
                            Image(systemName: "phone.arrow.up.right").foregroundStyle(Theme.textSecondary)
                            Text(call.calleeExtensionId ?? "Ramal").font(.footnote)
                            Spacer()
                            Text(call.status).font(.caption).foregroundStyle(Theme.textMuted)
                        }
                        .padding(.vertical, 6)
                        Divider()
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Início")
            .refreshable { await load() }
            .task { await load() }
            .confirmationDialog(
                "Confirmar acionamento do botão de pânico?",
                isPresented: $showPanicConfirm,
                titleVisibility: .visible
            ) {
                Button("Acionar emergência", role: .destructive) { Task { await triggerPanic() } }
                Button("Cancelar", role: .cancel) {}
            }
        }
    }

    private func load() async {
        guard let condominiumId = session.condominiumId else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            overview = try await session.authorized { token in try await session.api.reportsOverview(accessToken: token, condominiumId: condominiumId) }
            let calls = try await session.authorized { token in try await session.api.listCalls(accessToken: token, condominiumId: condominiumId) }
            recentCalls = calls.items
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }

    private func triggerPanic() async {
        guard let condominiumId = session.condominiumId else { return }
        isTriggeringPanic = true
        defer { isTriggeringPanic = false }
        do {
            _ = try await session.authorized { token in
                try await session.api.triggerPanicAlert(accessToken: token, condominiumId: condominiumId, triggeredBy: session.me?.email ?? "App do porteiro")
            }
            panicConfirmedMessage = "Alerta enviado ao síndico e ao monitoramento."
            await load()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
