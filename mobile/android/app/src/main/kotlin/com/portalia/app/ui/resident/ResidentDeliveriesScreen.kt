package com.portalia.app.ui.resident

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalResidentSession
import com.portalia.app.ui.shared.QrCodeImage
import com.portalia.app.ui.theme.Badge
import com.portalia.app.ui.theme.PortaliaSuccess
import com.portalia.core.model.DeliveryCredentialResponse
import com.portalia.core.model.DeliveryResponse
import com.portalia.core.net.ApiError
import kotlinx.coroutines.launch

@Composable
fun ResidentDeliveriesScreen() {
    val session = LocalResidentSession.current
    val scope = rememberCoroutineScope()
    var deliveries by remember { mutableStateOf<List<DeliveryResponse>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var credentialDialog by remember { mutableStateOf<DeliveryCredentialResponse?>(null) }
    var issuingId by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        isLoading = true
        try {
            deliveries = session.authorized { token -> session.api.listDeliveries(token) }.items
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
        isLoading = false
    }

    LaunchedEffect(Unit) { load() }

    if (isLoading && deliveries.isEmpty()) {
        CircularProgressIndicator(modifier = Modifier.padding(20.dp))
    } else if (deliveries.isEmpty()) {
        Text("Nenhuma entrega registrada", modifier = Modifier.padding(20.dp))
    } else {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
            items(deliveries) { delivery ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(delivery.description, fontWeight = FontWeight.Medium)
                    }
                    if (delivery.status == "PENDING") {
                        OutlinedButton(onClick = {
                            issuingId = delivery.id
                            scope.launch {
                                try {
                                    credentialDialog = session.authorized { token -> session.api.issueDeliveryCredential(token, delivery.id) }
                                } catch (e: Exception) {
                                    errorMessage = (e as? ApiError)?.message
                                }
                                issuingId = null
                            }
                        }) {
                            if (issuingId == delivery.id) CircularProgressIndicator(modifier = Modifier.padding(2.dp)) else Text("Ver código")
                        }
                    } else {
                        Badge("Retirada", PortaliaSuccess)
                    }
                }
            }
        }
    }

    credentialDialog?.let { credential ->
        AlertDialog(
            onDismissRequest = { credentialDialog = null },
            confirmButton = { Button(onClick = { credentialDialog = null }) { Text("Fechar") } },
            title = { Text("Retirada") },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Código de retirada", style = MaterialTheme.typography.bodySmall)
                    Text(credential.pickupCode, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
                    QrCodeImage(payload = credential.qrPayload)
                    androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
                    Text("Mostre o código ou o QR code na portaria para retirar.", style = MaterialTheme.typography.bodySmall, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            },
        )
    }
}
