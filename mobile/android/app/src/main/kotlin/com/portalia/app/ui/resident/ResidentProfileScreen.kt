package com.portalia.app.ui.resident

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalResidentSession
import kotlinx.coroutines.launch

@Composable
fun ResidentProfileScreen() {
    val session = LocalResidentSession.current
    val scope = rememberCoroutineScope()
    val me by session.me.collectAsState()

    Column(Modifier.fillMaxSize().padding(20.dp)) {
        me?.let { profile ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier.size(48.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(initials(profile.name), fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                }
                androidx.compose.foundation.layout.Spacer(Modifier.padding(start = 12.dp))
                Column {
                    Text(profile.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("${profile.condominium.name} · Apto ${profile.unit.identifier}", style = MaterialTheme.typography.bodySmall)
                }
            }

            androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 20.dp))
            Text("Email: ${profile.email ?: "—"}")
            Text("Telefone: ${profile.phone ?: "—"}")
        }

        androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
        Button(
            onClick = { scope.launch { session.logout() } },
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Sair") }
    }
}

private fun initials(name: String): String =
    name.split(" ").take(2).mapNotNull { it.firstOrNull() }.joinToString("").uppercase()
