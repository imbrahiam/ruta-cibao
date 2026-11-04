// Native build for the Ruta Cibao apps. The Gradle root lives in native/ so the
// repo root stays free of wrapper files; the KMP core (packages/kmp) and the
// Android app (apps/android) still share one build, and the iOS app consumes
// the core as the RutaKit framework.
pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ruta-cibao"
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

include(":apps:android")
project(":apps").projectDir = file("../apps")
project(":apps:android").projectDir = file("../apps/android")

listOf("api", "core", "data", "presentation", "shared").forEach { name ->
    include(":kmp:$name")
    project(":kmp:$name").projectDir = file("../packages/kmp/$name")
}
project(":kmp").projectDir = file("../packages/kmp")
