import SwiftUI
import PortaliaCore

enum AppRole: String, CaseIterable, Identifiable {
    case resident = "Morador"
    case staff = "Equipe (portaria)"
    var id: String { rawValue }
}

struct RoleLoginView: View {
    @EnvironmentObject private var staffSession: StaffSession
    @EnvironmentObject private var residentSession: ResidentSession

    @State private var role: AppRole = .resident
    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false

    private var errorMessage: String? {
        role == .resident ? residentSession.errorMessage : staffSession.errorMessage
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text("Portalia")
                        .font(.largeTitle.weight(.bold))
                    Text("Gestão de portaria remota e híbrida")
                        .font(.footnote)
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.top, 40)

                Picker("Perfil", selection: $role) {
                    ForEach(AppRole.allCases) { role in
                        Text(role.rawValue).tag(role)
                    }
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email").font(.footnote.weight(.medium))
                        TextField("voce@empresa.com.br", text: $email)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .textFieldStyle(.roundedBorder)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Senha").font(.footnote.weight(.medium))
                        SecureField("Digite sua senha", text: $password)
                            .textFieldStyle(.roundedBorder)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Theme.danger)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        if isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Text("Entrar na plataforma")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(isSubmitting || email.isEmpty || password.isEmpty)
                }
                .padding(20)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            }
            .padding(20)
        }
        .background(Theme.background)
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        switch role {
        case .resident:
            _ = await residentSession.login(email: email, password: password)
        case .staff:
            _ = await staffSession.login(email: email, password: password)
        }
    }
}
