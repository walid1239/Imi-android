package com.walid.chat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.walid.chat.ui.AuthScreen
import com.walid.chat.ui.IMIApp
import com.walid.chat.ui.theme.IMITheme

class MainActivity : ComponentActivity() {
    private var auth: FirebaseAuth? = null
    private var signedInUid by mutableStateOf<String?>(null)
    private var firebaseSetupError by mutableStateOf<String?>(null)
    private var authListener: FirebaseAuth.AuthStateListener? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            val firebaseApp = FirebaseApp.getApps(applicationContext).firstOrNull()
                ?: error("إعداد Firebase غير موجود في هذه النسخة.")
            auth = FirebaseAuth.getInstance(firebaseApp)
            signedInUid = auth?.currentUser?.uid
            authListener = FirebaseAuth.AuthStateListener { current ->
                signedInUid = current.currentUser?.uid
            }.also { auth?.addAuthStateListener(it) }
        } catch (error: Exception) {
            firebaseSetupError = error.localizedMessage
                ?: "تعذر تهيئة Firebase. تحقق من إعداد التطبيق."
        }

        setContent {
            IMITheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    when {
                        firebaseSetupError != null -> AuthScreen(
                            auth = null,
                            setupError = firebaseSetupError
                        )
                        auth == null -> AuthScreen(auth = null)
                        signedInUid == null -> AuthScreen(auth = auth)
                        else -> IMIApp(
                            cloudSessionMessage = "متصل بحساب IMI • UID: ${signedInUid?.take(8)}…"
                        )
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        authListener?.let { listener -> auth?.removeAuthStateListener(listener) }
        authListener = null
        super.onDestroy()
    }
}
