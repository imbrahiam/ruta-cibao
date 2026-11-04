import org.jetbrains.kotlin.gradle.plugin.mpp.apple.XCFramework

plugins {
    id("ruta.kmp.library")
    alias(libs.plugins.metro)
    alias(libs.plugins.skie)
}

/**
 * The umbrella the apps link. It owns the DI graph and is the only module
 * exported to Swift, as the static framework RutaKit.
 */
kotlin {
    android { namespace = "rutacibao.kmp.shared" }

    val xcf = XCFramework("RutaKit")
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "RutaKit"
            isStatic = true
            export(projects.kmp.api)
            export(projects.kmp.core)
            export(projects.kmp.data)
            export(projects.kmp.presentation)
            xcf.add(this)
        }
    }

    sourceSets {
        commonMain.dependencies {
            api(projects.kmp.api)
            api(projects.kmp.core)
            api(projects.kmp.data)
            api(projects.kmp.presentation)
        }
        commonTest.dependencies { implementation(kotlin("test")) }
    }
}

skie {
    analytics { enabled.set(false) }
}
