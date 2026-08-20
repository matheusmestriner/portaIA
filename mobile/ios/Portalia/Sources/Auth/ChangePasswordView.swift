import SwiftUI
import PortaliaCore

struct ChangePasswordView: View {
    let role: AppRole

    @EnvironmentObject private var staffSession: StaffSession
    @EnvironmentObject private var residentSession: ResidentSession

    @State private var current = ""
    @State private var new = ""
    @State private var confirm = ""
    @State private var isSubmitting = false
    @State private var localError: String?

    private var errorMessage: String? {
        localError ?? (role == .resident ? residentSession.errorMessage : staffSession.errorMessage)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Troca de senha obrigatória")
                    .font(.title2.weight(.semibold))
                Text("Por segurança, defina uma nova senha antes de continuar.")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Senha atual").font(.footnote.weight(.medium))
                    SecureField("", text: $current).textFieldStyle(.roundedBorder)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Nova senha").font(.footnote.weight(.medium))
                    SecureField("Mínimo 12 caracteres", text: $new).textFieldStyle(.roundedBorder)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Confirmar nova senha").font(.footnote.weight(.medium))
                    SecureField("", text: $confirm).textFieldStyle(.roundedBorder)
                }

                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(Theme.danger)
                }

                Button {
                    Task { await submit() }
                } label: {
                    if isSubmitting {
                        ProgressView().tint(.white)
                    } else {
                        Text("Salvar nova senha")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSubmitting || current.isEmpty || new.isEmpty || confirm.isEmpty)
            }
            .padding(20)
        }
        .background(Theme.background)
    }

    private func submit() async {
        guard new == confirm else {
            localError = "As senhas novas não coincidem."
            return
        }
        localError = nil
        isSubmitting = true
        defer { isSubmitting = false }
        switch role {
        case .resident:
            _ = await residentSession.changePassword(current: current, new: new)
        case .staff:
            _ = await staffSession.changePassword(current: current, new: new)
        }
    }
}
