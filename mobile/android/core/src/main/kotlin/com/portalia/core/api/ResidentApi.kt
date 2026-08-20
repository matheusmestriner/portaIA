package com.portalia.core.api

import com.portalia.core.model.*
import com.portalia.core.net.ApiRequest
import com.portalia.core.net.HttpClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import java.util.UUID

class ResidentApi(private val http: HttpClient) {

    @Serializable private data class LoginBody(val email: String, val password: String)
    suspend fun login(email: String, password: String): ResidentLoginResponse {
        val body = http.json.encodeToString(LoginBody(email, password))
        return http.send(ApiRequest(path = "resident-auth/login", method = "POST", body = body))
    }

    @Serializable private data class RefreshBody(val refreshToken: String)
    suspend fun refresh(refreshToken: String): ResidentRefreshResponse {
        val body = http.json.encodeToString(RefreshBody(refreshToken))
        return http.send(ApiRequest(path = "resident-auth/refresh", method = "POST", body = body))
    }

    suspend fun logout(accessToken: String) {
        http.sendUnit(ApiRequest(path = "resident-auth/logout", method = "POST", headers = authHeader(accessToken)))
    }

    @Serializable private data class ChangePasswordBody(val currentPassword: String, val newPassword: String)
    suspend fun changePassword(accessToken: String, current: String, new: String): ResidentChangePasswordResponse {
        val body = http.json.encodeToString(ChangePasswordBody(current, new))
        return http.send(ApiRequest(path = "resident-auth/change-password", method = "POST", body = body, headers = authHeader(accessToken)))
    }

    suspend fun me(accessToken: String): ResidentMeResponse =
        http.send(ApiRequest(path = "resident/me", headers = authHeader(accessToken)))

    suspend fun dashboard(accessToken: String): ResidentDashboardResponse =
        http.send(ApiRequest(path = "resident/dashboard", headers = authHeader(accessToken)))

    suspend fun listAnnouncements(accessToken: String, page: Int = 1, pageSize: Int = 20): Paginated<AnnouncementResponse> =
        http.send(ApiRequest(path = "resident/announcements", query = mapOf("page" to "$page", "pageSize" to "$pageSize"), headers = authHeader(accessToken)))

    suspend fun listDeliveries(accessToken: String, page: Int = 1, pageSize: Int = 20): Paginated<DeliveryResponse> =
        http.send(ApiRequest(path = "resident/deliveries", query = mapOf("page" to "$page", "pageSize" to "$pageSize"), headers = authHeader(accessToken)))

    suspend fun issueDeliveryCredential(accessToken: String, deliveryId: String): DeliveryCredentialResponse =
        http.send(ApiRequest(
            path = "resident/deliveries/$deliveryId/credential",
            method = "POST",
            headers = authHeader(accessToken, idempotencyKey = UUID.randomUUID().toString()),
        ))

    suspend fun telephonyCredentials(accessToken: String): ResidentTelephonyCredentials =
        http.send(ApiRequest(path = "resident/telephony/credentials", headers = authHeader(accessToken)))

    private fun authHeader(accessToken: String, idempotencyKey: String? = null): Map<String, String> =
        buildMap {
            put("Authorization", "Bearer $accessToken")
            if (idempotencyKey != null) put("Idempotency-Key", idempotencyKey)
        }
}
