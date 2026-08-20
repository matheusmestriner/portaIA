package com.portalia.core.config

/**
 * Aponta para o backend Portalia. `10.0.2.2` é o alias que o emulador Android
 * usa para "o localhost da máquina que roda o emulador" — troque para o IP
 * real na rede ao testar num aparelho físico.
 */
object AppConfig {
    const val API_BASE_URL = "http://10.0.2.2:3101/api/v1/"
}
