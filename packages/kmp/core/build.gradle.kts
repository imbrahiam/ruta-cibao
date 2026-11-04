plugins { id("ruta.kmp.library") }

kotlin {
    android { namespace = "rutacibao.kmp.core" }
    sourceSets {
        commonMain.dependencies {
            api(libs.kotlinx.coroutines.core)
            api(libs.kermit)
        }
        commonTest.dependencies { implementation(kotlin("test")) }
    }
}
