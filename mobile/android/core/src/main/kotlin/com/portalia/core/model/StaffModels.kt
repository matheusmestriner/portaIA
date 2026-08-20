package com.portalia.core.model

import kotlinx.serialization.Serializable

@Serializable
data class StaffLoginResponse(val accessToken: String, val mustChangePassword: Boolean, val csrfToken: String)

@Serializable
data class StaffRefreshResponse(val accessToken: String, val csrfToken: String, val mustChangePassword: Boolean)

/** POST /auth/change-password devolve só isto — sem mustChangePassword. */
@Serializable
data class StaffChangePasswordResponse(val accessToken: String, val csrfToken: String)

@Serializable
data class StaffMeResponse(
    val id: String,
    val email: String,
    val role: String,
    val resaleId: String? = null,
    val clientId: String? = null,
    val condominiumId: String? = null,
    val mustChangePassword: Boolean,
)

@Serializable
data class ReportsOverview(
    val units: Int,
    val residents: Int,
    val vehicles: Int,
    val activeProviders: Int,
    val visitorsToday: Int,
    val pendingDeliveries: Int,
    val openOccurrences: Int,
    val keysCheckedOut: Int,
    val activePanicAlerts: Int,
)

@Serializable
data class UnitResponse(
    val id: String,
    val condominiumId: String,
    val identifier: String,
    val block: String? = null,
    val floor: String? = null,
    val isActive: Boolean,
)

@Serializable
data class ExtensionResponse(
    val id: String,
    val unitId: String,
    val condominiumId: String,
    val number: String,
    val sipUsername: String,
    val isActive: Boolean,
)

@Serializable
data class CallResponse(
    val id: String,
    val condominiumId: String,
    val externalCallId: String? = null,
    val callerType: String,
    val callerExtensionId: String? = null,
    val calleeType: String,
    val calleeExtensionId: String? = null,
    val status: String,
    val queuedAt: String? = null,
    val ringingAt: String? = null,
    val answeredAt: String? = null,
    val endedAt: String? = null,
    val endReason: String? = null,
    val createdAt: String,
)

@Serializable
data class AnnouncementResponse(
    val id: String,
    val condominiumId: String,
    val title: String,
    val body: String,
    val createdBy: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class DeliveryResponse(
    val id: String,
    val unitId: String,
    val condominiumId: String,
    val residentId: String? = null,
    val description: String,
    val carrier: String? = null,
    val courierName: String? = null,
    val trackingCode: String? = null,
    val volumeCount: Int,
    val status: String,
    val pickedUpBy: String? = null,
    val pickupDocument: String? = null,
    val pickupCodeLast4: String? = null,
    val pickupCredentialExpiresAt: String? = null,
    val receivedAt: String,
    val collectedAt: String? = null,
)

@Serializable
data class DeliveryCredentialResponse(
    val delivery: DeliveryResponse,
    val pickupCode: String,
    val qrToken: String,
    val qrPayload: String,
    val expiresAt: String? = null,
)

@Serializable
data class PanicAlertResponse(
    val id: String,
    val condominiumId: String,
    val unitId: String? = null,
    val triggeredBy: String,
    val acknowledgedAt: String? = null,
    val resolvedAt: String? = null,
    val createdAt: String,
)
