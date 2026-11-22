plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Public, non-secret config baked into the build (see AppConfig).
val apiOrigin: String = providers.gradleProperty("ruta.apiOrigin").get()
val appLinkHost: String = uri(apiOrigin).host

// Google Maps key: never committed. Pass `-Pruta.googleMapsKey=...` or set it in ~/.gradle/gradle.properties.
val mapsKey: String = providers.gradleProperty("ruta.googleMapsKey").getOrElse("")

// Public Firebase Android application config, not the server service-account key.
// Manual FirebaseOptions avoids requiring a committed google-services.json/plugin.
val firebaseApplicationId = providers.gradleProperty("ruta.firebaseApplicationId").getOrElse("")
// The `.dev` package is a second Firebase app in the same project.
val firebaseApplicationIdDev = providers.gradleProperty("ruta.firebaseApplicationIdDev").getOrElse(firebaseApplicationId)
val firebaseApiKey = providers.gradleProperty("ruta.firebaseApiKey").getOrElse("")
val firebaseProjectId = providers.gradleProperty("ruta.firebaseProjectId").getOrElse("")
val firebaseSenderId = providers.gradleProperty("ruta.firebaseSenderId").getOrElse("")
// Release signing: a keystore outside the repository, named by gradle properties (CI passes them
// from its secrets). Without them the release build stays unsigned, as before.
val releaseStoreFile = providers.gradleProperty("ruta.releaseStoreFile").orNull
val releaseStorePassword = providers.gradleProperty("ruta.releaseStorePassword").orNull
val releaseKeyAlias = providers.gradleProperty("ruta.releaseKeyAlias").getOrElse("ruta-cibao")
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""

android {
    namespace = "rutacibao.android"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "do.rutacibao.app"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "API_ORIGIN", "\"$apiOrigin\"")
        buildConfigField("String", "APP_SCHEME", "\"rutacibao\"")
        buildConfigField("String", "VARIANT", "\"Production\"")
        buildConfigField("boolean", "HAS_MAPS_KEY", mapsKey.isNotBlank().toString())
        manifestPlaceholders["googleMapsKey"] = mapsKey
        manifestPlaceholders["appScheme"] = "rutacibao"
        manifestPlaceholders["appLinkHost"] = appLinkHost
        buildConfigField("String", "FIREBASE_APPLICATION_ID", quoted(firebaseApplicationId))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(firebaseApiKey))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(firebaseProjectId))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(firebaseSenderId))
    }

    signingConfigs {
        if (releaseStoreFile != null && releaseStorePassword != null) {
            create("release") {
                storeFile = file(releaseStoreFile)
                storeType = "pkcs12"
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseStorePassword
            }
        }
    }

    buildTypes {
        debug {
            // Side by side with the store build: its own id, scheme and session.
            applicationIdSuffix = ".dev"
            buildConfigField("String", "APP_SCHEME", "\"rutacibao-dev\"")
            buildConfigField("String", "VARIANT", "\"Development\"")
            buildConfigField("String", "FIREBASE_APPLICATION_ID", quoted(firebaseApplicationIdDev))
            manifestPlaceholders["appScheme"] = "rutacibao-dev"
        }
        release {
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

kotlin { jvmToolchain(21) }

dependencies {
    implementation(projects.kmp.shared)
    implementation(libs.kotlinx.serialization.json)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.ktor3)
    implementation(libs.maps.compose)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.firebase.messaging)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
}
