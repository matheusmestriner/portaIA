package com.portalia.core.auth

import com.portalia.core.api.ResidentApi
import com.portalia.core.model.ResidentMeResponse
import com.portalia.core.net.ApiError
import com.portalia.core.net.HttpClient
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.CookieJar

/**
 * Sessão do app do morador. O refresh token vem no corpo da resposta (não
 * cookie) e é guardado no SecureStore — ver ResidentApi/ResidentAuth no
 * backend, desenhado mobile-first desde o início, ao contrário do fluxo de
 * equipe que foi construído pra navegador primeiro.
 */
class ResidentSession(
    val api: ResidentApi,
    private val store: SecureStore,
) {
    private val _me = MutableStateFlow<ResidentMeResponse?>(null)
    val me: StateFlow<ResidentMeResponse?> = _me

    private val _mustChangePassword = MutableStateFlow(false)
    val mustChangePassword: StateFlow<Boolean> = _mustChangePassword

    private val _isBootstrapping = MutableStateFlow(true)
    val isBootstrapping: StateFlow<Boolean> = _isBootstrapping

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    private var accessToken: String? = null
    private var inFlightRefresh: Deferred<Unit>? = null

    val isAuthenticated: Boolean get() = accessToken != null && _me.value != null

    suspend fun bootstrap() {
        if (store.get(SecureStoreKey.RESIDENT_REFRESH_TOKEN) != null) {
            refresh()
        }
        _isBootstrapping.value = false
    }

    suspend fun login(email: String, password: String): Boolean {
        _errorMessage.value = null
        return try {
            val result = api.login(email, password)
            accessToken = result.accessToken
            store.set(SecureStoreKey.RESIDENT_REFRESH_TOKEN, result.refreshToken)
            _mustChangePassword.value = result.mustChangePassword
            loadMe()
            true
        } catch (e: Exception) {
            _errorMessage.value = (e as? ApiError)?.message ?: "Não foi possível entrar."
            false
        }
    }

    suspend fun logout() {
        accessToken?.let { token -> try { api.logout(token) } catch (e: Exception) { } }
        store.remove(SecureStoreKey.RESIDENT_REFRESH_TOKEN)
        accessToken = null
        _me.value = null
        _mustChangePassword.value = false
    }

    suspend fun changePassword(current: String, new: String): Boolean {
        val token = accessToken ?: return false
        _errorMessage.value = null
        return try {
            val result = api.changePassword(token, current, new)
            accessToken = result.accessToken
            store.set(SecureStoreKey.RESIDENT_REFRESH_TOKEN, result.refreshToken)
            _mustChangePassword.value = false
            true
        } catch (e: Exception) {
            _errorMessage.value = (e as? ApiError)?.message ?: "Não foi possível trocar a senha."
            false
        }
    }

    suspend fun <T> authorized(call: suspend (String) -> T): T {
        val token = accessToken ?: throw ApiError.Unauthorized
        return try {
            call(token)
        } catch (e: ApiError.Unauthorized) {
            refresh()
            val retryToken = accessToken ?: throw ApiError.Unauthorized
            call(retryToken)
        }
    }

    private suspend fun refresh() {
        val existing = inFlightRefresh
        if (existing != null) {
            existing.await()
            return
        }
        coroutineScope {
            val task = async { performRefresh() }
            inFlightRefresh = task
            task.await()
            inFlightRefresh = null
        }
    }

    private suspend fun performRefresh() {
        val refreshToken = store.get(SecureStoreKey.RESIDENT_REFRESH_TOKEN)
        if (refreshToken == null) {
            accessToken = null
            _me.value = null
            return
        }
        try {
            val result = api.refresh(refreshToken)
            accessToken = result.accessToken
            store.set(SecureStoreKey.RESIDENT_REFRESH_TOKEN, result.refreshToken)
            _mustChangePassword.value = result.mustChangePassword
            if (_me.value == null) loadMe()
        } catch (e: Exception) {
            store.remove(SecureStoreKey.RESIDENT_REFRESH_TOKEN)
            accessToken = null
            _me.value = null
        }
    }

    private suspend fun loadMe() {
        val token = accessToken ?: return
        try {
            _me.value = api.me(token)
        } catch (e: Exception) {
            _errorMessage.value = (e as? ApiError)?.message
        }
    }

    companion object {
        fun create(context: android.content.Context): ResidentSession {
            val store = SecureStore.shared(context)
            val http = HttpClient(cookieJar = CookieJar.NO_COOKIES)
            return ResidentSession(ResidentApi(http), store)
        }
    }
}
