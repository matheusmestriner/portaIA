import SwiftUI
import PortaliaCore

@main
struct PortaliaApp: App {
    @StateObject private var staffSession = StaffSession()
    @StateObject private var residentSession = ResidentSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(staffSession)
                .environmentObject(residentSession)
        }
    }
}
