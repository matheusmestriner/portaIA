package com.portalia.core.model

import kotlinx.serialization.Serializable

@Serializable
data class ResidentLoginResponse(val accessToken: String, val refreshToken: String, val mustChangePassword: Boolean)

@Serializable
data class ResidentRefreshResponse(val accessToken: String, val refreshToken: String, val mustChangePassword: Boolean)

/** POST /resident-auth/change-password devolve só isto — sem mustChangePassword. */
@Serializable
data class ResidentChangePasswordResponse(val accessToken: String, val refreshToken: String)

@Serializable
data class ResidentUnitSummary(val id: String, val identifier: String, val block: String? = null)

@Serializable
data class ResidentCondominiumSummary(val id: String, val name: String)

@Serializable
data class ResidentMeResponse(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val unit: ResidentUnitSummary,
    val condominium: ResidentCondominiumSummary,
)

@Serializable
data class ResidentDashboardResponse(
    val pendingDeliveries: Int,
    val visitorsThisMonth: Int,
    val avgVisitsPerWeek: Double? = null,
    val avgVisitDurationMinutes: Int? = null,
)

@Serializable
data class ResidentTelephonyCredentials(
    val configured: Boolean,
    val sipUsername: String? = null,
    val sipPassword: String? = null,
    val domain: String? = null,
)
