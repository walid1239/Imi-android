package com.walid.chat.data.repository

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

/**
 * Anonymous Firebase Auth gives each installation a real Firebase UID without OTP.
 * It does not verify a phone number or provide account recovery after app data loss.
 */
class FirebaseSessionRepository(
    private val auth: FirebaseAuth
) {
    suspend fun ensureSignedIn(): Result<String> = runCatching {
        auth.currentUser?.uid ?: auth.signInAnonymously().await().user?.uid
            ?: error("تعذر إنشاء جلسة IMI السحابية")
    }

    fun currentUid(): String? = auth.currentUser?.uid

    companion object {
        fun create(context: Context): FirebaseSessionRepository {
            check(FirebaseApp.getApps(context.applicationContext).isNotEmpty()) {
                "Firebase غير مهيأ. أضف google-services.json لتطبيق com.walid.chat."
            }
            return FirebaseSessionRepository(FirebaseAuth.getInstance())
        }
    }
}
