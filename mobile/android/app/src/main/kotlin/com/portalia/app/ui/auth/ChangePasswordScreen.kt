package com.portalia.app.ui.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalResidentSession
import com.portalia.app.ui.LocalStaffSession
import kotlinx.coroutines.launch

@Composable
fun ChangePasswordScreen(role: AppRole) {
    val staffSession = LocalStaffSession.current
    val residentSession = LocalResidentSession.current
    val scope = rememberCoroutineScope()

    var current by remember { mutableStateOf("") }
    var new by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var localError by remember { mutableStateOf<String?>(null) }

    val remoteError = if (role == AppRole.Resident) residentSession.errorMessage.collectAsState().value else staffSession.errorMessage.collectAsState().value
    val errorMessage = localError ?: remoteError

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Text("Troca de senha obrigatória", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text("Por segurança, defina uma nova senha antes de continuar.", style = MaterialTheme.typography.bodySmall)

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))
        OutlinedTextField(current, { current = it }, label = { Text("Senha atual") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedTextField(new, { new = it }, label = { Text("Nova senha (mínimo 12 caracteres)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedTextField(confirm, { confirm = it }, label = { Text("Confirmar nova senha") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())

        errorMessage?.let {
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))
        Button(
            onClick = {
                if (new != confirm) {
                    localError = "As senhas novas não coincidem."
                    return@Button
                }
                localError = null
                isSubmitting = true
                scope.launch {
                    if (role == AppRole.Resident) residentSession.changePassword(current, new) else staffSession.changePassword(current, new)
                    isSubmitting = false
                }
            },
            enabled = !isSubmitting && current.isNotEmpty() && new.isNotEmpty() && confirm.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isSubmitting) CircularProgressIndicator(modifier = Modifier.padding(4.dp)) else Text("Salvar nova senha")
        }
    }
}
