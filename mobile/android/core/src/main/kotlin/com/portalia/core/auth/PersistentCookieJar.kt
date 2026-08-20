package com.portalia.core.auth

import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

@Serializable
private data class StoredCookie(
    val name: String,
    val value: String,
    val domain: String,
    val path: String,
    val expiresAt: Long,
    val secure: Boolean,
    val httpOnly: Boolean,
)

/**
 * OkHttp não persiste cookies entre processos por padrão — sem isto, o
 * refresh cookie httpOnly de equipe (30 dias de validade no backend) seria
 * perdido a cada vez que o app fosse fechado, forçando login de novo
 * sempre. Serializa pro SecureStore (Keystore por baixo) em vez de deixar
 * em texto puro, mesmo não sendo estritamente exigido pelo próprio cookie.
 */
class PersistentCookieJar(private val store: SecureStore) : CookieJar {
    private val json = Json { ignoreUnknownKeys = true }
    private val storeKey = "portalia.staff.cookies"

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val existing = loadAll().filterNot { stored -> cookies.any { it.name == stored.name && it.domain == stored.domain } }
        val updated = existing + cookies.map {
            StoredCookie(it.name, it.value, it.domain, it.path, it.expiresAt, it.secure, it.httpOnly)
        }
        persist(updated)
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        return loadAll()
            .filter { it.expiresAt > now }
            .mapNotNull { stored ->
                Cookie.Builder()
                    .name(stored.name)
                    .value(stored.value)
                    .domain(stored.domain)
                    .path(stored.path)
                    .expiresAt(stored.expiresAt)
                    .apply { if (stored.secure) secure() }
                    .apply { if (stored.httpOnly) httpOnly() }
                    .build()
            }
            .filter { it.matches(url) }
    }

    fun clear() {
        store.remove(storeKey)
    }

    /** Lê o valor de um cookie específico sem precisar de uma requisição real — usado para recuperar o CSRF cookie ao reabrir o app (ver StaffSession.performRefresh). */
    fun cookieValue(url: HttpUrl, name: String): String? =
        loadForRequest(url).firstOrNull { it.name == name }?.value

    private fun loadAll(): List<StoredCookie> {
        val raw = store.get(storeKey) ?: return emptyList()
        return try {
            json.decodeFromString(raw)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun persist(cookies: List<StoredCookie>) {
        store.set(storeKey, json.encodeToString(cookies))
    }
}
