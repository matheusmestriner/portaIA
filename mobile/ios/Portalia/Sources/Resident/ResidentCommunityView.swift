import SwiftUI
import PortaliaCore

struct ResidentCommunityView: View {
    @EnvironmentObject private var session: ResidentSession
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
                            Text(announcement.createdAt, style: .date)
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
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
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await session.authorized { token in try await session.api.listAnnouncements(accessToken: token) }
            announcements = page.items
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
        }
    }
}
