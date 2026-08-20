package com.portalia.app.ui.doorman

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CallMade
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalStaffSession
import com.portalia.app.ui.theme.PortaliaSuccess
import com.portalia.app.ui.theme.StatCard
import com.portalia.core.model.CallResponse
import com.portalia.core.model.ReportsOverview
import com.portalia.core.net.ApiError
import kotlinx.coroutines.launch

@Composable
fun DoormanHomeScreen() {
    val session = LocalStaffSession.current
    val scope = rememberCoroutineScope()
    var overview by remember { mutableStateOf<ReportsOverview?>(null) }
    var recentCalls by remember { mutableStateOf<List<CallResponse>>(emptyList()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showPanicConfirm by remember { mutableStateOf(false) }
    var isTriggeringPanic by remember { mutableStateOf(false) }
    var panicConfirmedMessage by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        val condominiumId = session.condominiumId ?: return
        try {
            overview = session.authorized { token -> session.api.reportsOverview(token, condominiumId) }
            recentCalls = session.authorized { token -> session.api.listCalls(token, condominiumId) }.items
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Portaria", style = MaterialTheme.typography.bodySmall)
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))

        Button(
            onClick = { showPanicConfirm = true },
            enabled = !isTriggeringPanic,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Warning, contentDescription = null)
                Text("Botão de pânico", fontWeight = FontWeight.SemiBold)
                Text("Aciona emergência para síndico e monitoramento", style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
            }
        }

        panicConfirmedMessage?.let { Text(it, color = PortaliaSuccess, style = MaterialTheme.typography.bodySmall) }
        // Sem isto o erro era gravado no estado e nunca mostrado: um pânico
        // que falhou parecia não ter feito nada, que é o pior desfecho possível
        // justamente nesta tela.
        errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }

        overview?.let { o ->
            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 12.dp))
            LazyVerticalGrid(columns = GridCells.Fixed(2), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(listOf("Entregas pendentes" to "${o.pendingDeliveries}", "Alertas de pânico ativos" to "${o.activePanicAlerts}")) { (label, value) ->
                    StatCard(label, value, modifier = Modifier.fillMaxWidth())
                }
            }
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))
        Text("Chamadas recentes", fontWeight = FontWeight.SemiBold)
        if (recentCalls.isEmpty()) {
            Text("Nenhuma chamada recente.", style = MaterialTheme.typography.bodySmall)
        }
        androidx.compose.foundation.lazy.LazyColumn {
            androidx.compose.foundation.lazy.items(recentCalls) { call ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Row {
                        Icon(Icons.Filled.CallMade, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                        Text(call.calleeExtensionId ?: "Ramal", style = MaterialTheme.typography.bodySmall)
                    }
                    Text(call.status, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }

    if (showPanicConfirm) {
        AlertDialog(
            onDismissRequest = { showPanicConfirm = false },
            title = { Text("Confirmar acionamento do botão de pânico?") },
            confirmButton = {
                Button(
                    onClick = {
                        showPanicConfirm = false
                        isTriggeringPanic = true
                        scope.launch {
                            val condominiumId = session.condominiumId
                            if (condominiumId != null) {
                                try {
                                    session.authorized { token ->
                                        session.api.triggerPanicAlert(token, condominiumId, session.me.value?.email ?: "App do porteiro")
                                    }
                                    panicConfirmedMessage = "Alerta enviado ao síndico e ao monitoramento."
                                    load()
                                } catch (e: Exception) {
                                    errorMessage = (e as? ApiError)?.message
                                }
                            }
                            isTriggeringPanic = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("Acionar emergência") }
            },
            dismissButton = { Button(onClick = { showPanicConfirm = false }) { Text("Cancelar") } },
        )
    }
}
