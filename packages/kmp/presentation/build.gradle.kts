plugins {
    id("ruta.kmp.library")
    alias(libs.plugins.metro)
}

kotlin {
    android { namespace = "rutacibao.kmp.presentation" }
    sourceSets {
        commonMain.dependencies {
            api(projects.kmp.data)
            api(libs.androidx.lifecycle.viewmodel)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }
    }
}
