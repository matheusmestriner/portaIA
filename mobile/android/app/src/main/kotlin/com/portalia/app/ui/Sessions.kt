package com.portalia.app.ui

import androidx.compose.runtime.staticCompositionLocalOf
import com.portalia.core.auth.ResidentSession
import com.portalia.core.auth.StaffSession

val LocalStaffSession = staticCompositionLocalOf<StaffSession> { error("No StaffSession provided") }
val LocalResidentSession = staticCompositionLocalOf<ResidentSession> { error("No ResidentSession provided") }
