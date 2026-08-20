package com.portalia.app.ui.doorman

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalStaffSession
import com.portalia.core.model.AnnouncementResponse
import com.portalia.core.net.ApiError

/** Só leitura: CONDO_OPERATOR não tem COMMUNICATION_MANAGE no backend — ver backend/src/auth/rbac/permissions.ts. */
@Composable
fun DoormanCommunityScreen() {
    val session = LocalStaffSession.current
    var announcements by remember { mutableStateOf<List<AnnouncementResponse>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val condominiumId = session.condominiumId ?: return@LaunchedEffect
        isLoading = true
        try {
            announcements = session.authorized { token -> session.api.listAnnouncements(token, condominiumId) }.items
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
        isLoading = false
    }

    if (isLoading && announcements.isEmpty()) {
        CircularProgressIndicator(modifier = Modifier.padding(20.dp))
    } else if (announcements.isEmpty()) {
        Text("Nenhum comunicado ainda", modifier = Modifier.padding(20.dp))
    } else {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
            items(announcements) { announcement ->
                Column(Modifier.padding(vertical = 10.dp)) {
                    Text(announcement.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(announcement.body, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
