import SwiftUI
import PortaliaCore

struct RootView: View {
    @EnvironmentObject private var staffSession: StaffSession
    @EnvironmentObject private var residentSession: ResidentSession
    @State private var didBootstrap = false

    var body: some View {
        Group {
            if !didBootstrap {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.background)
            } else if residentSession.isAuthenticated {
                if residentSession.mustChangePassword {
                    ChangePasswordView(role: .resident)
                } else {
                    ResidentRootView()
                }
            } else if staffSession.isAuthenticated {
                if staffSession.mustChangePassword {
                    ChangePasswordView(role: .staff)
                } else {
                    DoormanRootView()
                }
            } else {
                RoleLoginView()
            }
        }
        .task {
            async let staffBootstrap: Void = staffSession.bootstrap()
            async let residentBootstrap: Void = residentSession.bootstrap()
            _ = await (staffBootstrap, residentBootstrap)
            didBootstrap = true
        }
    }
}
