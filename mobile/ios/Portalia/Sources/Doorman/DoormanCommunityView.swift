import SwiftUI
import PortaliaCore

/// Só leitura: CONDO_OPERATOR (o papel que normalmente opera este app) não
/// tem COMMUNICATION_MANAGE no backend, só CONDO_MANAGER/gestores têm — ver
/// backend/src/auth/rbac/permissions.ts. Criar comunicado fica fora daqui.
struct DoormanCommunityView: View {
    @EnvironmentObject private var session: StaffSession
    @State private var announcements: [AnnouncementResponse] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && announcements.isEmpty {
                    ProgressView()
                } else if announcements.isEmpty {
                    ContentUnavailableView("Nenhum comunicado ainda", systemImage: "megaphone")
                } else {
                    List(announcements) { announcement in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(announcement.title).font(.headline)
                            Text(announcement.body).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        }
                        .padding(.vertical, 4)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Comunidade")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        guard let condominiumId = session.condominiumId else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await session.authorized { token in try await session.api.listAnnouncements(accessToken: token, condominiumId: condominiumId) }
            announcements = page.items
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
