plugins {
    id("ruta.kmp.library")
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.metro)
}

kotlin {
    android { namespace = "rutacibao.kmp.data" }
    sourceSets {
        commonMain.dependencies {
            api(projects.kmp.api)
            api(projects.kmp.core)
            implementation(libs.ktor.client.logging)
        }
        androidMain.dependencies { implementation(libs.ktor.client.okhttp) }
        iosMain.dependencies { implementation(libs.ktor.client.darwin) }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.ktor.client.mock)
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}
