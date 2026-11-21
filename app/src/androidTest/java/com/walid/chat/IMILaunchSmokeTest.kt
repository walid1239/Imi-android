package com.walid.chat

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

/**
 * Device-level smoke test: launches the real Activity and verifies the Arabic
 * Firebase sign-in gate. No anonymous identity is created automatically.
 */
class IMILaunchSmokeTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun launchesAndShowsArabicSignInScreen() {
        composeRule.onNodeWithText("تسجيل الدخول").assertIsDisplayed()
        composeRule.onNodeWithText("البريد الإلكتروني").assertIsDisplayed()
        composeRule.onNodeWithText("المتابعة باستخدام Google").assertIsDisplayed()
        composeRule.onNodeWithText("الدخول كضيف").assertIsDisplayed()
    }
}
