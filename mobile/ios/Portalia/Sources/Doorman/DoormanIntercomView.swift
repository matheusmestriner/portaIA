import SwiftUI
import PortaliaCore

struct DoormanIntercomView: View {
    @EnvironmentObject private var session: StaffSession
    @State private var units: [UnitResponse] = []
    @State private var extensionsByUnit: [String: ExtensionResponse] = [:]
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var callingUnitId: String?
    @State private var errorMessage: String?

    private var filteredUnits: [UnitResponse] {
        guard !searchText.isEmpty else { return units }
        return units.filter { $0.identifier.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && units.isEmpty {
                    ProgressView()
                } else {
                    List(filteredUnits) { unit in
                        HStack {
                            Text("Apto \(unit.identifier)")
                            Spacer()
                            if let ext = extensionsByUnit[unit.id] {
                                if callingUnitId == unit.id {
                                    ProgressView()
                                } else {
                                    Button {
                                        Task { await call(unit: unit, extensionId: ext.id) }
                                    } label: {
                                        Image(systemName: "phone.fill")
                                    }
                                }
                            } else {
                                Text("Sem ramal").font(.caption).foregroundStyle(Theme.textMuted)
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .searchable(text: $searchText, prompt: "Buscar apto")
            .navigationTitle("Interfone")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        guard let condominiumId = session.condominiumId else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let unitsPage = try await session.authorized { token in try await session.api.listUnits(accessToken: token, condominiumId: condominiumId) }
            let extensionsPage = try await session.authorized { token in try await session.api.listExtensions(accessToken: token, condominiumId: condominiumId) }
            units = unitsPage.items
            // `uniqueKeysWithValues` faz trap (crash) em chave repetida. O
            // schema tem `unitId @unique` em Extension, então duplicata não
            // deveria existir — mas um crash do app do porteiro é caro demais
            // para depender de uma invariante do banco; na dúvida, prefere o ramal ativo.
            extensionsByUnit = Dictionary(
                extensionsPage.items.map { ($0.unitId, $0) },
                uniquingKeysWith: { current, new in new.isActive ? new : current }
            )
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }

    private func call(unit: UnitResponse, extensionId: String) async {
        callingUnitId = unit.id
        defer { callingUnitId = nil }
        do {
            _ = try await session.authorized { token in
                try await session.api.originateCall(accessToken: token, calleeExtensionId: extensionId, triggeredBy: session.me?.email ?? "App do porteiro")
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
