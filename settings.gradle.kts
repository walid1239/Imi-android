pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        // Google-hosted Maven Central mirror improves resilience when GitHub-hosted
        // runner egress is temporarily blocked or rate-limited by public Central.
        maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2/") }
        maven { url = uri("https://repo1.maven.org/maven2") }
        mavenCentral()
    }
}
rootProject.name = "IMI"
include(":app")
