import SwiftUI
import PortaliaCore

struct DoormanDeliveriesView: View {
    @EnvironmentObject private var session: StaffSession
    @State private var pendingDeliveries: [DeliveryResponse] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRedeemSheet = false
    @State private var showNewDeliverySheet = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && pendingDeliveries.isEmpty {
                    ProgressView()
                } else if pendingDeliveries.isEmpty {
                    ContentUnavailableView("Nenhuma entrega pendente", systemImage: "shippingbox")
                } else {
                    List(pendingDeliveries) { delivery in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(delivery.description).font(.subheadline.weight(.medium))
                            Text(delivery.receivedAt, style: .relative).font(.caption).foregroundStyle(Theme.textMuted)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Entregas")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button("Retirada") { showRedeemSheet = true }
                        Button("Nova entrega") { showNewDeliverySheet = true }
                    }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $showNewDeliverySheet) {
                NewDeliverySheet(onCreated: { Task { await load() } })
            }
            .sheet(isPresented: $showRedeemSheet) {
                RedeemDeliverySheet(onRedeemed: { Task { await load() } })
            }
        }
    }

    private func load() async {
        guard let condominiumId = session.condominiumId else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await session.authorized { token in
                try await session.api.listDeliveries(accessToken: token, condominiumId: condominiumId, status: "PENDING")
            }
            pendingDeliveries = page.items
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}

private struct NewDeliverySheet: View {
    let onCreated: () -> Void
    @EnvironmentObject private var session: StaffSession
    @Environment(\.dismiss) private var dismiss

    @State private var units: [UnitResponse] = []
    @State private var selectedUnitId: String?
    @State private var description = ""
    @State private var carrier = ""
    @State private var isSubmitting = false
    @State private var issuedCredential: DeliveryCredentialResponse?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            if let issuedCredential {
                VStack(spacing: 16) {
                    Text("Entrega registrada").font(.headline)
                    VStack(spacing: 4) {
                        Text("Código de retirada").font(.footnote).foregroundStyle(Theme.textSecondary)
                        Text(issuedCredential.pickupCode).font(.system(size: 36, weight: .bold, design: .monospaced)).tracking(4)
                    }
                    QRCodeView(payload: issuedCredential.qrPayload)
                    Text("O código também foi enviado por WhatsApp, se o morador tiver telefone cadastrado.")
                        .font(.footnote).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                    Button("Concluir") { dismiss() }.buttonStyle(PrimaryButtonStyle())
                }
                .padding(24)
            } else {
                Form {
                    Picker("Unidade", selection: $selectedUnitId) {
                        Text("Selecione").tag(String?.none)
                        ForEach(units) { unit in Text("Apto \(unit.identifier)").tag(Optional(unit.id)) }
                    }
                    TextField("Descrição", text: $description)
                    TextField("Transportadora (opcional)", text: $carrier)
                    if let errorMessage {
                        Text(errorMessage).font(.footnote).foregroundStyle(Theme.danger)
                    }
                }
                .navigationTitle("Nova entrega")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Registrar") { Task { await submit() } }
                            .disabled(isSubmitting || selectedUnitId == nil || description.isEmpty)
                    }
                }
                .task { await loadUnits() }
            }
        }
    }

    private func loadUnits() async {
        guard let condominiumId = session.condominiumId else { return }
        do {
            let page = try await session.authorized { token in try await session.api.listUnits(accessToken: token, condominiumId: condominiumId) }
            units = page.items
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }

    private func submit() async {
        guard let unitId = selectedUnitId else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            issuedCredential = try await session.authorized { token in
                try await session.api.createDelivery(
                    accessToken: token,
                    unitId: unitId,
                    description: description,
                    carrier: carrier.isEmpty ? nil : carrier,
                    courierName: nil
                )
            }
            onCreated()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}

private struct RedeemDeliverySheet: View {
    let onRedeemed: () -> Void
    @EnvironmentObject private var session: StaffSession
    @Environment(\.dismiss) private var dismiss

    @State private var credential = ""
    @State private var pickedUpBy = ""
    @State private var isSubmitting = false
    @State private var showScanner = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Código informado pelo morador") {
                    TextField("000000", text: $credential)
                        .keyboardType(.numberPad)
                    Button {
                        showScanner = true
                    } label: {
                        Label("Escanear QR", systemImage: "qrcode.viewfinder")
                    }
                }
                Section("Retirado por") {
                    TextField("Nome de quem está retirando", text: $pickedUpBy)
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(Theme.danger)
                }
                if let successMessage {
                    Text(successMessage).font(.footnote).foregroundStyle(Theme.success)
                }
            }
            .navigationTitle("Confirmar retirada")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirmar") { Task { await submit() } }
                        .disabled(isSubmitting || credential.isEmpty || pickedUpBy.isEmpty)
                }
            }
            .sheet(isPresented: $showScanner) {
                QRScannerSheet { payload in credential = payload }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            _ = try await session.authorized { token in
                try await session.api.redeemDelivery(accessToken: token, credential: credential, pickedUpBy: pickedUpBy)
            }
            successMessage = "Retirada confirmada."
            onRedeemed()
            try? await Task.sleep(for: .seconds(1))
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
