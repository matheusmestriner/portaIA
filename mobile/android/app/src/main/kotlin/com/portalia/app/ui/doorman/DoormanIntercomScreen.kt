package com.portalia.app.ui.doorman

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.dp
import com.portalia.app.ui.LocalStaffSession
import com.portalia.core.model.ExtensionResponse
import com.portalia.core.model.UnitResponse
import com.portalia.core.net.ApiError
import kotlinx.coroutines.launch

@Composable
fun DoormanIntercomScreen() {
    val session = LocalStaffSession.current
    val scope = rememberCoroutineScope()
    var units by remember { mutableStateOf<List<UnitResponse>>(emptyList()) }
    var extensionsByUnit by remember { mutableStateOf<Map<String, ExtensionResponse>>(emptyMap()) }
    var searchText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var callingUnitId by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val condominiumId = session.condominiumId ?: return@LaunchedEffect
        isLoading = true
        try {
            units = session.authorized { token -> session.api.listUnits(token, condominiumId) }.items
            val extensions = session.authorized { token -> session.api.listExtensions(token, condominiumId) }.items
            extensionsByUnit = extensions.associateBy { it.unitId }
        } catch (e: Exception) {
            errorMessage = (e as? ApiError)?.message
        }
        isLoading = false
    }

    val filteredUnits = if (searchText.isEmpty()) units else units.filter { it.identifier.contains(searchText, ignoreCase = true) }

    Column(Modifier.fillMaxSize().padding(20.dp)) {
        OutlinedTextField(
            value = searchText,
            onValueChange = { searchText = it },
            label = { Text("Buscar apto") },
            modifier = Modifier.fillMaxWidth(),
        )
        androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 8.dp))

        if (isLoading && units.isEmpty()) {
            CircularProgressIndicator()
        } else {
            LazyColumn {
                items(filteredUnits) { unit ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Apto ${unit.identifier}")
                        val extension = extensionsByUnit[unit.id]
                        when {
                            extension == null -> Text("Sem ramal", style = MaterialTheme.typography.labelSmall)
                            callingUnitId == unit.id -> CircularProgressIndicator(modifier = Modifier.padding(4.dp))
                            else -> IconButton(onClick = {
                                callingUnitId = unit.id
                                scope.launch {
                                    try {
                                        session.authorized { token ->
                                            session.api.originateCall(token, extension.id, session.me.value?.email ?: "App do porteiro")
                                        }
                                    } catch (e: Exception) {
                                        errorMessage = (e as? ApiError)?.message
                                    }
                                    callingUnitId = null
                                }
                            }) { Icon(Icons.Filled.Call, contentDescription = "Chamar") }
                        }
                    }
                }
            }
        }
    }
}
