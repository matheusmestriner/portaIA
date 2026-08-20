import SwiftUI
import PortaliaCore

struct ResidentRootView: View {
    var body: some View {
        TabView {
            ResidentCommunityView()
                .tabItem { Label("Comunidade", systemImage: "person.3.fill") }

            ResidentIntercomView()
                .tabItem { Label("Interfone", systemImage: "phone.fill") }

            ResidentHomeView()
                .tabItem { Label("Início", systemImage: "house.fill") }

            ResidentDeliveriesView()
                .tabItem { Label("Entregas", systemImage: "shippingbox.fill") }

            ResidentProfileView()
                .tabItem { Label("Perfil", systemImage: "person.fill") }
        }
        .tint(Theme.accent)
    }
}
