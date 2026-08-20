plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.portalia.core"
    compileSdk = 34

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // `api`, não `implementation`: estes três aparecem na superfície pública
    // do core e o módulo :app precisa enxergá-los para compilar —
    // HttpClient recebe um `CookieJar` (okhttp), as sessões expõem
    // `StateFlow` (coroutines) e `HttpClient.json` é um `Json`
    // (serialization). Com `implementation` eles não vazam para quem
    // depende do core, e o :app não compilaria.
    api("com.squareup.okhttp3:okhttp:4.12.0")
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    api("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
