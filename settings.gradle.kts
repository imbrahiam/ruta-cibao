// Native build for the Ruta Cibao apps. The Gradle root is the repo root so the
// KMP core (packages/kmp) and the Android app (apps/android) share one build;
// the iOS app consumes the core as the RutaKit framework.
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

listOf("api", "core", "data", "presentation", "shared").forEach { name ->
    include(":kmp:$name")
    project(":kmp:$name").projectDir = file("packages/kmp/$name")
}
project(":kmp").projectDir = file("packages/kmp")
