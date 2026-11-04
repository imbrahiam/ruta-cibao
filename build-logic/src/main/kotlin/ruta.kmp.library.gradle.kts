import org.jetbrains.kotlin.gradle.dsl.JvmTarget

/**
 * Every KMP module: Android + iOS (device and Apple-silicon simulator),
 * explicit API so the Swift surface is deliberate, JDK 21 bytecode.
 * The module sets its own Android namespace.
 */
plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.kotlin.multiplatform.library")
}

kotlin {
    explicitApi()
    jvmToolchain(21)

    android {
        compileSdk = 37
        minSdk = 26
        compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
    }
    iosArm64()
    iosSimulatorArm64()

    compilerOptions {
        freeCompilerArgs.addAll("-Xexpect-actual-classes")
        optIn.add("kotlin.time.ExperimentalTime")
    }
}
