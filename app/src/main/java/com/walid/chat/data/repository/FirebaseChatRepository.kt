package com.walid.chat.data.repository

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.walid.chat.data.model.Chat
import kotlinx.coroutines.tasks.await

/**
 * Firebase-backed implementation. It deliberately refuses to fall back to local
 * storage: a successful operation always reaches the configured Firebase project.
 */
class FirebaseChatRepository(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : ChatRepository {

    override suspend fun getChats(): Result<List<Chat>> = runCatching {
        val uid = requireUid()
        val snapshot = firestore.collection("conversations")
            .whereArrayContains("participants", uid)
            .orderBy("lastMessageAt", Query.Direction.DESCENDING)
            .get()
            .await()

        snapshot.documents.map { document ->
            val lastAt = document.getTimestamp("lastMessageAt")
            Chat(
                id = document.id,
                title = document.getString("title") ?: "محادثة",
                lastMessage = document.getString("lastMessage") ?: "",
                timestamp = lastAt?.toDate()?.toString() ?: "",
                unreadCount = 0
            )
        }
    }

    override suspend fun sendMessage(chatId: String, text: String): Result<Unit> = runCatching {
        require(chatId.isNotBlank()) { "معرّف المحادثة غير صالح" }
        val cleanText = text.trim()
        require(cleanText.isNotEmpty() && cleanText.length <= 1_000) {
            "نص الرسالة فارغ أو يتجاوز 1000 حرف"
        }
        val uid = requireUid()
        val conversation = firestore.collection("conversations").document(chatId)
        val message = conversation.collection("messages").document()

        firestore.runBatch { batch ->
            batch.set(message, mapOf(
                "senderUid" to uid,
                "type" to "text",
                "text" to cleanText,
                "createdAt" to FieldValue.serverTimestamp()
            ))
            batch.update(conversation, mapOf(
                "lastMessage" to cleanText,
                "lastMessageAt" to FieldValue.serverTimestamp(),
                "lastSenderUid" to uid
            ))
        }.await()
    }

    suspend fun createDirectConversation(otherUid: String): Result<String> = runCatching {
        val uid = requireUid()
        require(otherUid.isNotBlank() && otherUid != uid) { "المستخدم الآخر غير صالح" }
        val conversation = firestore.collection("conversations").document()
        conversation.set(mapOf(
            "participants" to listOf(uid, otherUid).sorted(),
            "createdBy" to uid,
            "createdAt" to FieldValue.serverTimestamp(),
            "lastMessage" to "",
            "lastMessageAt" to FieldValue.serverTimestamp()
        )).await()
        conversation.id
    }

    private fun requireUid(): String =
        auth.currentUser?.uid ?: error("الجلسة السحابية غير متاحة؛ أعد تسجيل الدخول")
}

/**
 * The default Firebase app is supplied by google-services.json at build time.
 * This factory fails closed if that configuration is missing.
 */
object FirebaseChatRepositoryFactory {
    fun create(context: Context): FirebaseChatRepository {
        check(FirebaseApp.getApps(context.applicationContext).isNotEmpty()) {
            "Firebase غير مهيأ. أضف google-services.json لتطبيق com.walid.chat."
        }
        return FirebaseChatRepository(
            FirebaseAuth.getInstance(),
            FirebaseFirestore.getInstance()
        )
    }
}
