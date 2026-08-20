package com.portalia.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.portalia.app.ui.auth.AppRole
import com.portalia.app.ui.auth.ChangePasswordScreen
import com.portalia.app.ui.auth.RoleLoginScreen
import com.portalia.app.ui.doorman.DoormanRootScreen
import com.portalia.app.ui.resident.ResidentRootScreen
import com.portalia.core.auth.ResidentSession
import com.portalia.core.auth.StaffSession
import kotlinx.coroutines.launch

@Composable
fun RootScreen(staffSession: StaffSession, residentSession: ResidentSession) {
    var didBootstrap by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch { staffSession.bootstrap() }
        scope.launch { residentSession.bootstrap() }
    }

    val residentAuthenticated = residentSession.me.collectAsState().value != null
    val staffAuthenticated = staffSession.me.collectAsState().value != null
    val residentMustChange = residentSession.mustChangePassword.collectAsState().value
    val staffMustChange = staffSession.mustChangePassword.collectAsState().value
    val residentBootstrapping = residentSession.isBootstrapping.collectAsState().value
    val staffBootstrapping = staffSession.isBootstrapping.collectAsState().value

    LaunchedEffect(residentBootstrapping, staffBootstrapping) {
        if (!residentBootstrapping && !staffBootstrapping) didBootstrap = true
    }

    CompositionLocalProvider(
        LocalStaffSession provides staffSession,
        LocalResidentSession provides residentSession,
    ) {
        when {
            !didBootstrap -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            residentAuthenticated && residentMustChange -> ChangePasswordScreen(role = AppRole.Resident)
            residentAuthenticated -> ResidentRootScreen()
            staffAuthenticated && staffMustChange -> ChangePasswordScreen(role = AppRole.Staff)
            staffAuthenticated -> DoormanRootScreen()
            else -> RoleLoginScreen()
        }
    }
}
