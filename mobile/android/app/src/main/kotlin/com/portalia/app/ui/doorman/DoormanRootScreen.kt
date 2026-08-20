package com.portalia.app.ui.doorman

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

private data class Tab(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val tabs = listOf(
    Tab("Comunidade", Icons.Filled.Group),
    Tab("Interfone", Icons.Filled.Phone),
    Tab("Início", Icons.Filled.Home),
    Tab("Entregas", Icons.Filled.LocalShipping),
    Tab("Perfil", Icons.Filled.Person),
)

@Composable
fun DoormanRootScreen() {
    var selected by remember { mutableIntStateOf(2) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selected == index,
                        onClick = { selected = index },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        androidx.compose.foundation.layout.Box(modifier = androidx.compose.ui.Modifier.padding(padding)) {
            when (selected) {
                0 -> DoormanCommunityScreen()
                1 -> DoormanIntercomScreen()
                2 -> DoormanHomeScreen()
                3 -> DoormanDeliveriesScreen()
                else -> DoormanProfileScreen()
            }
        }
    }
}
