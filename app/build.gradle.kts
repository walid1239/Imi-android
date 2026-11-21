plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Apply Firebase resource processing only when the app-specific config is present.
// This keeps public CI builds possible without committing google-services.json.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}


android {
    namespace = "com.walid.chat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.walid.chat"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Android uses the same server-authoritative Next.js API as the web client.
    // Override with -PimiApiBaseUrl=https://... for a controlled Preview build.
    val imiApiBaseUrl = providers.gradleProperty("imiApiBaseUrl")
        .orElse("https://imi-chi.vercel.app")
        .get()
        .trim()
        .trimEnd('/')
    require(imiApiBaseUrl.matches(Regex("^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$"))) {
        "imiApiBaseUrl must be an HTTPS origin without a path."
    }
    defaultConfig {
        buildConfigField("String", "IMI_API_BASE_URL", "\"$imiApiBaseUrl\"")
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.android.gms:play-services-auth:21.3.0")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-functions")
    // Force the maintained OkHttp 4.x line over Firebase Functions' obsolete 3.x transitive request.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}