plugins {
    id("ruta.kmp.library")
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    android { namespace = "rutacibao.kmp.api" }

    sourceSets {
        commonMain.dependencies {
            api(libs.ktor.client.core)
            api(libs.kotlinx.serialization.json)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.ktor.client.mock)
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}
