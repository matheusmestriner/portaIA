import SwiftUI
import PortaliaCore

struct ResidentDeliveriesView: View {
    @EnvironmentObject private var session: ResidentSession
    @State private var deliveries: [DeliveryResponse] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var credentialSheet: DeliveryCredentialResponse?
    @State private var issuingDeliveryId: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && deliveries.isEmpty {
                    ProgressView()
                } else if deliveries.isEmpty {
                    ContentUnavailableView("Nenhuma entrega registrada", systemImage: "shippingbox")
                } else {
                    List(deliveries) { delivery in
                        DeliveryRow(
                            delivery: delivery,
                            isIssuing: issuingDeliveryId == delivery.id,
                            onShowCode: { Task { await issueCredential(for: delivery) } }
                        )
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Entregas")
            .refreshable { await load() }
            .task { await load() }
            .sheet(item: $credentialSheet) { credential in
                DeliveryCredentialSheet(credential: credential)
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await session.authorized { token in try await session.api.listDeliveries(accessToken: token) }
            deliveries = page.items
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }

    private func issueCredential(for delivery: DeliveryResponse) async {
        issuingDeliveryId = delivery.id
        defer { issuingDeliveryId = nil }
        do {
            credentialSheet = try await session.authorized { token in
                try await session.api.issueDeliveryCredential(accessToken: token, deliveryId: delivery.id)
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}

private struct DeliveryRow: View {
    let delivery: DeliveryResponse
    let isIssuing: Bool
    let onShowCode: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(delivery.description).font(.subheadline.weight(.medium))
                Text(delivery.receivedAt, style: .date).font(.caption).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            if delivery.status == "PENDING" {
                Button(action: onShowCode) {
                    if isIssuing {
                        ProgressView()
                    } else {
                        Text("Ver código")
                    }
                }
                .buttonStyle(.bordered)
            } else {
                Badge(text: "Retirada", color: Theme.success)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct DeliveryCredentialSheet: View {
    let credential: DeliveryCredentialResponse
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text("Código de retirada").font(.footnote).foregroundStyle(Theme.textSecondary)
                    Text(credential.pickupCode)
                        .font(.system(size: 40, weight: .bold, design: .monospaced))
                        .tracking(4)
                }
                QRCodeView(payload: credential.qrPayload)
                Text("Mostre o código ou o QR code na portaria para retirar.")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                Spacer()
            }
            .padding(24)
            .navigationTitle("Retirada")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { dismiss() }
                }
            }
        }
    }
}
