package com.portalia.core.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Wrapper fino sobre EncryptedSharedPreferences (Keystore por baixo) — usado
 * para o refresh token do morador, que precisa sobreviver o processo morrer
 * (o app guarda em Keychain no iOS pelo mesmo motivo, ver ResidentSession).
 */
class SecureStore(context: Context) {
    private val prefs: SharedPreferences

    companion object {
        @Volatile
        private var instance: SecureStore? = null

        /**
         * Uma única instância por processo. Abrir dois
         * EncryptedSharedPreferences sobre o MESMO arquivo (era o caso: a
         * sessão de equipe e a do morador criavam um cada) é uma corrida de
         * inicialização do Keystore que pode lançar em alguns aparelhos.
         */
        fun shared(context: Context): SecureStore =
            instance ?: synchronized(this) {
                instance ?: SecureStore(context.applicationContext).also { instance = it }
            }
    }

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            "portalia_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun set(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    fun get(key: String): String? = prefs.getString(key, null)

    fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }
}

object SecureStoreKey {
    const val RESIDENT_REFRESH_TOKEN = "portalia.resident.refreshToken"
}
