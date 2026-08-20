package com.portalia.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.portalia.app.ui.RootScreen
import com.portalia.app.ui.theme.PortaliaTheme
import com.portalia.core.auth.ResidentSession
import com.portalia.core.auth.StaffSession

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val staffSession = remember { StaffSession.create(applicationContext) }
            val residentSession = remember { ResidentSession.create(applicationContext) }

            PortaliaTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    RootScreen(staffSession = staffSession, residentSession = residentSession)
                }
            }
        }
    }
}
