package com.portalia.core.api

import com.portalia.core.model.*
import com.portalia.core.net.ApiRequest
import com.portalia.core.net.HttpClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import java.util.UUID

class StaffApi(private val http: HttpClient) {

    @Serializable private data class LoginBody(val email: String, val password: String)
    suspend fun login(email: String, password: String): StaffLoginResponse {
        val body = http.json.encodeToString(LoginBody(email, password))
        return http.send(ApiRequest(path = "auth/login", method = "POST", body = body))
    }

    suspend fun refresh(csrfToken: String): StaffRefreshResponse =
        http.send(ApiRequest(path = "auth/refresh", method = "POST", headers = mapOf("X-CSRF-Token" to csrfToken)))

    suspend fun logout(accessToken: String, csrfToken: String) {
        http.sendUnit(ApiRequest(
            path = "auth/logout",
            method = "POST",
            headers = mapOf("Authorization" to "Bearer $accessToken", "X-CSRF-Token" to csrfToken),
        ))
    }

    @Serializable private data class ChangePasswordBody(val currentPassword: String, val newPassword: String)
    suspend fun changePassword(accessToken: String, current: String, new: String): StaffChangePasswordResponse {
        val body = http.json.encodeToString(ChangePasswordBody(current, new))
        return http.send(ApiRequest(path = "auth/change-password", method = "POST", body = body, headers = authHeader(accessToken)))
    }

    suspend fun me(accessToken: String): StaffMeResponse =
        http.send(ApiRequest(path = "auth/me", headers = authHeader(accessToken)))

    suspend fun reportsOverview(accessToken: String, condominiumId: String): ReportsOverview =
        http.send(ApiRequest(path = "reports/overview", query = mapOf("condominiumId" to condominiumId), headers = authHeader(accessToken)))

    suspend fun listUnits(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 50): Paginated<UnitResponse> =
        http.send(ApiRequest(
            path = "condominial/units",
            query = mapOf("condominiumId" to condominiumId, "page" to "$page", "pageSize" to "$pageSize"),
            headers = authHeader(accessToken),
        ))

    suspend fun listExtensions(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 100): Paginated<ExtensionResponse> =
        http.send(ApiRequest(
            path = "telephony/extensions",
            query = mapOf("condominiumId" to condominiumId, "page" to "$page", "pageSize" to "$pageSize"),
            headers = authHeader(accessToken),
        ))

    suspend fun listAnnouncements(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 20): Paginated<AnnouncementResponse> =
        http.send(ApiRequest(
            path = "notifications/announcements",
            query = mapOf("condominiumId" to condominiumId, "page" to "$page", "pageSize" to "$pageSize"),
            headers = authHeader(accessToken),
        ))

    suspend fun listCalls(accessToken: String, condominiumId: String, page: Int = 1, pageSize: Int = 20): Paginated<CallResponse> =
        http.send(ApiRequest(
            path = "telephony/calls",
            query = mapOf("condominiumId" to condominiumId, "page" to "$page", "pageSize" to "$pageSize"),
            headers = authHeader(accessToken),
        ))

    @Serializable private data class OriginateCallBody(val calleeExtensionId: String, val triggeredBy: String, val externalCallId: String)
    suspend fun originateCall(accessToken: String, calleeExtensionId: String, triggeredBy: String): CallResponse {
        val body = http.json.encodeToString(OriginateCallBody(calleeExtensionId, triggeredBy, UUID.randomUUID().toString()))
        return http.send(ApiRequest(path = "telephony/calls", method = "POST", body = body, headers = authHeader(accessToken, idempotencyKey = UUID.randomUUID().toString())))
    }

    suspend fun listDeliveries(accessToken: String, condominiumId: String, status: String? = null, page: Int = 1, pageSize: Int = 20): Paginated<DeliveryResponse> {
        val query = buildMap {
            put("condominiumId", condominiumId)
            put("page", "$page")
            put("pageSize", "$pageSize")
            if (status != null) put("status", status)
        }
        return http.send(ApiRequest(path = "gatehouse/deliveries", query = query, headers = authHeader(accessToken)))
    }

    @Serializable private data class CreateDeliveryBody(val unitId: String, val description: String, val carrier: String?, val courierName: String?, val volumeCount: Int)
    suspend fun createDelivery(accessToken: String, unitId: String, description: String, carrier: String?, courierName: String?, volumeCount: Int = 1): DeliveryCredentialResponse {
        val body = http.json.encodeToString(CreateDeliveryBody(unitId, description, carrier, courierName, volumeCount))
        return http.send(ApiRequest(path = "gatehouse/deliveries", method = "POST", body = body, headers = authHeader(accessToken, idempotencyKey = UUID.randomUUID().toString())))
    }

    @Serializable private data class RedeemDeliveryBody(val credential: String, val pickedUpBy: String)
    suspend fun redeemDelivery(accessToken: String, credential: String, pickedUpBy: String): DeliveryResponse {
        val body = http.json.encodeToString(RedeemDeliveryBody(credential, pickedUpBy))
        return http.send(ApiRequest(path = "gatehouse/deliveries/redeem", method = "POST", body = body, headers = authHeader(accessToken, idempotencyKey = UUID.randomUUID().toString())))
    }

    @Serializable private data class TriggerPanicBody(val condominiumId: String, val triggeredBy: String)
    suspend fun triggerPanicAlert(accessToken: String, condominiumId: String, triggeredBy: String): PanicAlertResponse {
        val body = http.json.encodeToString(TriggerPanicBody(condominiumId, triggeredBy))
        return http.send(ApiRequest(path = "security/panic-alerts", method = "POST", body = body, headers = authHeader(accessToken, idempotencyKey = UUID.randomUUID().toString())))
    }

    private fun authHeader(accessToken: String, idempotencyKey: String? = null): Map<String, String> =
        buildMap {
            put("Authorization", "Bearer $accessToken")
            if (idempotencyKey != null) put("Idempotency-Key", idempotencyKey)
        }
}
