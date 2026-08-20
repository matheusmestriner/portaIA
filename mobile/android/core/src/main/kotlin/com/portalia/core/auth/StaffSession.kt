package com.portalia.core.auth

import com.portalia.core.api.StaffApi
import com.portalia.core.config.AppConfig
import com.portalia.core.model.StaffMeResponse
import com.portalia.core.net.ApiError
import com.portalia.core.net.HttpClient
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.HttpUrl.Companion.toHttpUrl

/**
 * Sessão do app do porteiro (equipe). Espelha StaffSession do iOS: access
 * token só em memória, refresh cookie httpOnly persiste via
 * PersistentCookieJar (mesmo papel que HTTPCookieStorage no iOS).
 */
class StaffSession(
    val api: StaffApi,
    private val cookieJar: PersistentCookieJar,
) {
    private val _me = MutableStateFlow<StaffMeResponse?>(null)
    val me: StateFlow<StaffMeResponse?> = _me

    private val _mustChangePassword = MutableStateFlow(false)
    val mustChangePassword: StateFlow<Boolean> = _mustChangePassword

    private val _isBootstrapping = MutableStateFlow(true)
    val isBootstrapping: StateFlow<Boolean> = _isBootstrapping

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    private var accessToken: String? = null
    private var csrfToken: String? = null
    private var inFlightRefresh: Deferred<Unit>? = null

    val isAuthenticated: Boolean get() = accessToken != null && _me.value != null
    val condominiumId: String? get() = _me.value?.condominiumId

    suspend fun bootstrap() {
        refresh()
        _isBootstrapping.value = false
    }

    suspend fun login(email: String, password: String): Boolean {
        _errorMessage.value = null
        return try {
            val result = api.login(email, password)
            accessToken = result.accessToken
            csrfToken = result.csrfToken
            _mustChangePassword.value = result.mustChangePassword
            loadMe()
            true
        } catch (e: Exception) {
            _errorMessage.value = (e as? ApiError)?.message ?: "Não foi possível entrar."
            false
        }
    }

    suspend fun logout() {
        val token = accessToken
        val csrf = csrfToken
        if (token != null && csrf != null) {
            try { api.logout(token, csrf) } catch (e: Exception) { /* já saindo mesmo assim */ }
        }
        cookieJar.clear()
        accessToken = null
        csrfToken = null
        _me.value = null
        _mustChangePassword.value = false
    }

    suspend fun changePassword(current: String, new: String): Boolean {
        val token = accessToken ?: return false
        _errorMessage.value = null
        return try {
            val result = api.changePassword(token, current, new)
            accessToken = result.accessToken
            csrfToken = result.csrfToken
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

    /**
     * Chamadores concorrentes (ex.: duas telas relançando `authorized{}` ao
     * mesmo tempo depois de um 401) compartilham a mesma corrida de
     * refresh em vez de cada uma disparar a sua — mesmo desenho do
     * `inFlightRefresh` do frontend web e do iOS. Assume que este objeto é
     * sempre acessado a partir do dispatcher principal (Compose/ViewModel),
     * então não há necessidade de um Mutex explícito aqui.
     */
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
        val url = AppConfig.API_BASE_URL.toHttpUrl()
        val tokenToUse = csrfToken ?: cookieJar.cookieValue(url, "portalia_csrf")
        try {
            val result = api.refresh(tokenToUse ?: "")
            accessToken = result.accessToken
            csrfToken = result.csrfToken
            _mustChangePassword.value = result.mustChangePassword
            if (_me.value == null) loadMe()
        } catch (e: Exception) {
            accessToken = null
            csrfToken = null
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
        fun create(context: android.content.Context): StaffSession {
            val jar = PersistentCookieJar(SecureStore.shared(context))
            val http = HttpClient(cookieJar = jar)
            return StaffSession(StaffApi(http), jar)
        }
    }
}
