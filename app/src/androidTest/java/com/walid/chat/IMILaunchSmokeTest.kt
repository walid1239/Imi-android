package com.walid.chat

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

/**
 * Device-level smoke test: launches the real Activity and checks the Arabic home screen.
 * Firebase is intentionally not required for this UI-only test; MainActivity must show
 * an explicit cloud-configuration error rather than crashing when config is absent.
 */
class IMILaunchSmokeTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun launchesAndShowsArabicHomeScreen() {
        composeRule.onNodeWithText("مساحتك للتواصل والتعلّم").assertIsDisplayed()
    }
}
