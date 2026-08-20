package com.portalia.core.net

import com.portalia.core.config.AppConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer
import okhttp3.CookieJar
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

data class ApiRequest(
    val path: String,
    val method: String = "GET",
    val query: Map<String, String> = emptyMap(),
    val body: String? = null,
    val headers: Map<String, String> = emptyMap(),
)

/**
 * Cliente HTTP fino sobre OkHttp. `cookieJar` é injetado — o app do porteiro
 * usa PersistentCookieJar (o refresh cookie httpOnly de equipe precisa
 * sobreviver entre chamadas, do mesmo jeito que o navegador faria); o
 * cliente do morador não precisa de cookie nenhum (refresh token vai no
 * corpo, ver ResidentSession), então usa um CookieJar.NO_COOKIES normal.
 */
class HttpClient(
    private val baseUrl: String = AppConfig.API_BASE_URL,
    cookieJar: CookieJar = CookieJar.NO_COOKIES,
) {
    // `explicitNulls = false` é obrigatório, não cosmético: por padrão o
    // kotlinx.serialization serializa campo nulo como `"carrier": null`, e os
    // DTOs Zod do backend usam `.optional()` — que aceita o campo AUSENTE,
    // mas REJEITA null explícito. Sem isto, todo POST com campo opcional não
    // preenchido (registrar entrega, por exemplo) volta 400.
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }
    private val client = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .build()

    suspend fun sendUnit(request: ApiRequest) {
        sendRaw(request)
    }

    suspend inline fun <reified T> send(request: ApiRequest): T {
        val raw = sendRaw(request)
        return try {
            json.decodeFromString(serializer(), raw)
        } catch (e: Exception) {
            throw ApiError.Decoding(e)
        }
    }

    suspend fun sendRaw(request: ApiRequest): String = withContext(Dispatchers.IO) {
        val urlBuilder = (baseUrl + request.path).toHttpUrl().newBuilder()
        request.query.forEach { (key, value) -> urlBuilder.addQueryParameter(key, value) }

        val builder = Request.Builder().url(urlBuilder.build())
        request.headers.forEach { (key, value) -> builder.addHeader(key, value) }

        when (request.method) {
            "GET" -> builder.get()
            "POST" -> builder.post((request.body ?: "").toRequestBody("application/json".toMediaType()))
            "PUT" -> builder.put((request.body ?: "").toRequestBody("application/json".toMediaType()))
            "DELETE" -> builder.delete(request.body?.toRequestBody("application/json".toMediaType()))
            else -> builder.method(request.method, request.body?.toRequestBody("application/json".toMediaType()))
        }

        val response = try {
            client.newCall(builder.build()).execute()
        } catch (e: Exception) {
            throw ApiError.Network(e)
        }

        // Última expressão do `use { }` (não um `return@withContext` explícito
        // dentro dele) — evita depender de `withContext` ser inline pra um
        // rótulo de retorno não-local através de duas lambdas aninhadas.
        response.use { resp ->
            val bodyString = resp.body?.string().orEmpty()
            if (resp.code == 401) throw ApiError.Unauthorized
            if (!resp.isSuccessful) {
                val envelope = try { json.decodeFromString<ServerErrorEnvelope>(bodyString) } catch (e: Exception) { null }
                if (envelope != null) {
                    throw ApiError.Server(resp.code, envelope.error.code, envelope.error.message)
                }
                throw ApiError.Server(resp.code, null, "Erro inesperado (${resp.code})")
            }
            bodyString
        }
    }
}
