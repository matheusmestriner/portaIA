package com.portalia.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SegmentedButtonDefaults
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
import androidx.compose.ui.Alignment
import com.portalia.app.ui.LocalResidentSession
import com.portalia.app.ui.LocalStaffSession
import kotlinx.coroutines.launch

enum class AppRole(val label: String) { Resident("Morador"), Staff("Equipe (portaria)") }

// SingleChoiceSegmentedButtonRow/SegmentedButton ainda são @ExperimentalMaterial3Api.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleLoginScreen() {
    val staffSession = LocalStaffSession.current
    val residentSession = LocalResidentSession.current
    val scope = rememberCoroutineScope()

    var role by remember { mutableStateOf(AppRole.Resident) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    val errorMessage = if (role == AppRole.Resident) {
        residentSession.errorMessage.collectAsState().value
    } else {
        staffSession.errorMessage.collectAsState().value
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Portalia", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Gestão de portaria remota e híbrida", style = MaterialTheme.typography.bodySmall)

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 20.dp))

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            AppRole.entries.forEachIndexed { index, r ->
                SegmentedButton(
                    selected = role == r,
                    onClick = { role = r },
                    shape = SegmentedButtonDefaults.itemShape(index = index, count = AppRole.entries.size),
                ) { Text(r.label) }
            }
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
        )
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Senha") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )

        errorMessage?.let {
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))

        Button(
            onClick = {
                isSubmitting = true
                scope.launch {
                    if (role == AppRole.Resident) residentSession.login(email, password) else staffSession.login(email, password)
                    isSubmitting = false
                }
            },
            enabled = !isSubmitting && email.isNotEmpty() && password.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isSubmitting) CircularProgressIndicator(modifier = Modifier.padding(4.dp)) else Text("Entrar na plataforma")
        }
    }
}
