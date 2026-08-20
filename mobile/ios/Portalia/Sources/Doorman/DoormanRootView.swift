import SwiftUI
import PortaliaCore

struct DoormanRootView: View {
    var body: some View {
        TabView {
            DoormanCommunityView()
                .tabItem { Label("Comunidade", systemImage: "person.3.fill") }

            DoormanIntercomView()
                .tabItem { Label("Interfone", systemImage: "phone.fill") }

            DoormanHomeView()
                .tabItem { Label("Início", systemImage: "house.fill") }

            DoormanDeliveriesView()
                .tabItem { Label("Entregas", systemImage: "shippingbox.fill") }

            DoormanProfileView()
                .tabItem { Label("Perfil", systemImage: "person.fill") }
        }
        .tint(Theme.accent)
    }
}
