package com.portalia.app.ui.resident

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalResidentSession
import com.portalia.app.ui.theme.Badge
import com.portalia.app.ui.theme.PortaliaWarning
import com.portalia.core.model.ResidentTelephonyCredentials
import com.portalia.core.net.ApiError

@Composable
fun ResidentIntercomScreen() {
    val session = LocalResidentSession.current
    var credentials by remember { mutableStateOf<ResidentTelephonyCredentials?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            credentials = session.authorized { token -> session.api.telephonyCredentials(token) }
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
        isLoading = false
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .size(84.dp)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Business, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
        Text("Portaria", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))

        when {
            isLoading -> CircularProgressIndicator()
            credentials?.configured == true -> {
                Text("Ramal ${credentials?.sipUsername} · ${credentials?.domain}", style = MaterialTheme.typography.bodySmall)
                androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
                Button(onClick = {}, modifier = Modifier.fillMaxWidth()) { Text("Chamar portaria") }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Badge("SIP não configurado", PortaliaWarning)
                    androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
                    Text(
                        "O interfone deste condomínio ainda não foi ativado pelo administrador. Assim que o servidor SIP for configurado, as chamadas passam a funcionar aqui automaticamente.",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
        }
    }
}
