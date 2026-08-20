package com.portalia.app.ui.doorman

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import com.portalia.app.ui.LocalStaffSession
import com.portalia.app.ui.shared.QrCodeImage
import com.portalia.app.ui.shared.QrScannerScreen
import com.portalia.core.model.DeliveryCredentialResponse
import com.portalia.core.model.DeliveryResponse
import com.portalia.core.model.UnitResponse
import com.portalia.core.net.ApiError
import kotlinx.coroutines.launch

private enum class DeliveriesRoute { LIST, NEW, REDEEM, SCAN }

@Composable
fun DoormanDeliveriesScreen() {
    val session = LocalStaffSession.current
    val scope = rememberCoroutineScope()
    var route by remember { mutableStateOf(DeliveriesRoute.LIST) }
    var pendingDeliveries by remember { mutableStateOf<List<DeliveryResponse>>(emptyList()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var scannedCredential by remember { mutableStateOf("") }

    suspend fun load() {
        val condominiumId = session.condominiumId ?: return
        try {
            pendingDeliveries = session.authorized { token -> session.api.listDeliveries(token, condominiumId, status = "PENDING") }.items
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
    }

    LaunchedEffect(route) { if (route == DeliveriesRoute.LIST) load() }

    when (route) {
        DeliveriesRoute.LIST -> Column(Modifier.fillMaxSize().padding(20.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { route = DeliveriesRoute.REDEEM }) { Text("Retirada") }
                Button(onClick = { route = DeliveriesRoute.NEW }) { Text("Nova entrega") }
            }
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
            if (pendingDeliveries.isEmpty()) {
                Text("Nenhuma entrega pendente")
            } else {
                LazyColumn {
                    items(pendingDeliveries) { delivery ->
                        Text(delivery.description, modifier = Modifier.padding(vertical = 8.dp))
                    }
                }
            }
        }

        DeliveriesRoute.NEW -> NewDeliveryScreen(onDone = { route = DeliveriesRoute.LIST })

        DeliveriesRoute.REDEEM -> RedeemDeliveryScreen(
            initialCredential = scannedCredential,
            onScanRequested = { route = DeliveriesRoute.SCAN },
            onDone = { scannedCredential = ""; route = DeliveriesRoute.LIST },
            onCancel = { scannedCredential = ""; route = DeliveriesRoute.LIST },
        )

        DeliveriesRoute.SCAN -> QrScannerScreen(
            onScan = { payload -> scannedCredential = payload; route = DeliveriesRoute.REDEEM },
            onCancel = { route = DeliveriesRoute.REDEEM },
        )
    }
}

@Composable
private fun NewDeliveryScreen(onDone: () -> Unit) {
    val session = LocalStaffSession.current
    val scope = rememberCoroutineScope()
    var units by remember { mutableStateOf<List<UnitResponse>>(emptyList()) }
    var selectedUnit by remember { mutableStateOf<UnitResponse?>(null) }
    var unitMenuExpanded by remember { mutableStateOf(false) }
    var description by remember { mutableStateOf("") }
    var carrier by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var issuedCredential by remember { mutableStateOf<DeliveryCredentialResponse?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val condominiumId = session.condominiumId ?: return@LaunchedEffect
        try {
            units = session.authorized { token -> session.api.listUnits(token, condominiumId) }.items
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
    }

    if (issuedCredential != null) {
        val credential = issuedCredential!!
        Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Entrega registrada", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
            Text("Código de retirada", style = MaterialTheme.typography.bodySmall)
            Text(credential.pickupCode, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
            QrCodeImage(payload = credential.qrPayload)
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
            Text("O código também foi enviado por WhatsApp, se o morador tiver telefone cadastrado.", textAlign = androidx.compose.ui.text.style.TextAlign.Center, style = MaterialTheme.typography.bodySmall)
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))
            Button(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text("Concluir") }
        }
        return
    }

    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Nova entrega", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))

        Row {
            OutlinedButton(onClick = { unitMenuExpanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(selectedUnit?.let { "Apto ${it.identifier}" } ?: "Selecione a unidade")
            }
            DropdownMenu(expanded = unitMenuExpanded, onDismissRequest = { unitMenuExpanded = false }) {
                units.forEach { unit ->
                    DropdownMenuItem(text = { Text("Apto ${unit.identifier}") }, onClick = { selectedUnit = unit; unitMenuExpanded = false })
                }
            }
        }
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedTextField(description, { description = it }, label = { Text("Descrição") }, modifier = Modifier.fillMaxWidth())
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedTextField(carrier, { carrier = it }, label = { Text("Transportadora (opcional)") }, modifier = Modifier.fillMaxWidth())

        errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onDone) { Text("Cancelar") }
            Button(
                onClick = {
                    val unit = selectedUnit ?: return@Button
                    isSubmitting = true
                    scope.launch {
                        try {
                            issuedCredential = session.authorized { token ->
                                session.api.createDelivery(token, unit.id, description, carrier.ifEmpty { null }, null)
                            }
                        } catch (e: Exception) {
                            errorMessage = (e as? ApiError)?.message
                        }
                        isSubmitting = false
                    }
                },
                enabled = !isSubmitting && selectedUnit != null && description.isNotEmpty(),
            ) {
                if (isSubmitting) CircularProgressIndicator(modifier = Modifier.padding(2.dp)) else Text("Registrar")
            }
        }
    }
}

@Composable
private fun RedeemDeliveryScreen(initialCredential: String, onScanRequested: () -> Unit, onDone: () -> Unit, onCancel: () -> Unit) {
    val session = LocalStaffSession.current
    val scope = rememberCoroutineScope()
    var credential by remember(initialCredential) { mutableStateOf(initialCredential) }
    var pickedUpBy by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Confirmar retirada", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
        OutlinedTextField(credential, { credential = it }, label = { Text("Código informado pelo morador") }, modifier = Modifier.fillMaxWidth())
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedButton(onClick = onScanRequested, modifier = Modifier.fillMaxWidth()) { Text("Escanear QR") }
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))
        OutlinedTextField(pickedUpBy, { pickedUpBy = it }, label = { Text("Retirado por") }, modifier = Modifier.fillMaxWidth())

        errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        successMessage?.let { Text(it, color = com.portalia.app.ui.theme.PortaliaSuccess) }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onCancel) { Text("Fechar") }
            Button(
                onClick = {
                    isSubmitting = true
                    scope.launch {
                        try {
                            session.authorized { token -> session.api.redeemDelivery(token, credential, pickedUpBy) }
                            successMessage = "Retirada confirmada."
                            onDone()
                        } catch (e: Exception) {
                            errorMessage = (e as? ApiError)?.message
                        }
                        isSubmitting = false
                    }
                },
                enabled = !isSubmitting && credential.isNotEmpty() && pickedUpBy.isNotEmpty(),
            ) {
                if (isSubmitting) CircularProgressIndicator(modifier = Modifier.padding(2.dp)) else Text("Confirmar")
            }
        }
    }
}
