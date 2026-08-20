package com.portalia.core.net

import kotlinx.serialization.Serializable

sealed class ApiError(message: String) : Exception(message) {
    class Network(cause: Throwable) : ApiError("Não foi possível conectar ao servidor.")
    class Decoding(cause: Throwable) : ApiError("Resposta inesperada do servidor.")
    class Server(val status: Int, val code: String?, val serverMessage: String) : ApiError(serverMessage)
    object Unauthorized : ApiError("Sessão expirada. Entre novamente.")
    object Unknown : ApiError("Algo deu errado. Tente novamente.")
}

@Serializable
data class ServerErrorEnvelope(val error: ServerErrorBody)

@Serializable
data class ServerErrorBody(val code: String? = null, val message: String)
