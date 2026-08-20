package com.portalia.app.ui.resident

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalResidentSession
import com.portalia.app.ui.theme.StatCard
import com.portalia.core.model.ResidentDashboardResponse
import com.portalia.core.net.ApiError

@Composable
fun ResidentHomeScreen() {
    val session = LocalResidentSession.current
    val me by session.me.collectAsState()
    var dashboard by remember { mutableStateOf<ResidentDashboardResponse?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            dashboard = session.authorized { token -> session.api.dashboard(token) }
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
        isLoading = false
    }

    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Olá, ${me?.name?.split(" ")?.firstOrNull().orEmpty()}", style = MaterialTheme.typography.bodySmall)
        Text("Apto ${me?.unit?.identifier.orEmpty()}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)

        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 16.dp))

        if (isLoading && dashboard == null) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
        } else {
            dashboard?.let { d ->
                LazyVerticalGrid(columns = GridCells.Fixed(2), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(
                        listOf(
                            "Entregas pendentes" to "${d.pendingDeliveries}",
                            "Visitantes no mês" to "${d.visitorsThisMonth}",
                            "Média de visitas" to (d.avgVisitsPerWeek?.let { "$it/sem" } ?: "—"),
                            "Tempo médio" to "Não disponível",
                        ),
                    ) { (label, value) -> StatCard(label, value, modifier = Modifier.fillMaxWidth()) }
                }
            }
            errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}
