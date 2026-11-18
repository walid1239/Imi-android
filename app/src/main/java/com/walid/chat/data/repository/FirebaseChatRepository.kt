package com.walid.chat.data.repository

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.walid.chat.data.model.Chat
import com.walid.chat.data.model.ChatMessage
import com.walid.chat.data.model.PublicProfile
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
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
            val members = (document.get("participants") as? List<*>)?.filterIsInstance<String>().orEmpty()
            val otherUid = members.firstOrNull { it != uid }
            val profile = otherUid?.let { firestore.collection("publicProfiles").document(it).get().await() }
            val lastAt = document.getTimestamp("lastMessageAt")
            Chat(
                id = document.id,
                title = profile?.getString("displayName")?.takeIf { it.isNotBlank() }
                    ?: otherUid?.take(8)?.let { "مستخدم $it" } ?: "محادثة",
                lastMessage = document.getString("lastMessage") ?: "",
                timestamp = lastAt?.toDate()?.toString() ?: "",
                unreadCount = 0
            )
        }
    }

    /**
     * Streams messages in chronological order. The listener is removed when the
     * collector is cancelled, so leaving a chat does not leave a Firestore listener.
     */
    override fun observeMessages(chatId: String): Flow<Result<List<ChatMessage>>> = callbackFlow {
        if (chatId.isBlank()) {
            trySend(Result.failure(IllegalArgumentException("معرّف المحادثة غير صالح")))
            close()
            return@callbackFlow
        }

        var registration: ListenerRegistration? = null
        try {
            requireUid()
            registration = firestore.collection("conversations")
                .document(chatId)
                .collection("messages")
                .orderBy("createdAt", Query.Direction.ASCENDING)
                .addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        trySend(Result.failure(error))
                    } else if (snapshot != null) {
                        val messages = snapshot.documents.map { document ->
                            ChatMessage(
                                id = document.id,
                                senderUid = document.getString("senderUid") ?: "",
                                type = document.getString("type") ?: "text",
                                text = document.getString("text") ?: "",
                                timestamp = document.getTimestamp("createdAt")?.toDate()?.toString() ?: "",
                                mediaPath = document.getString("mediaPath")
                            )
                        }
                        trySend(Result.success(messages))
                    }
                }
        } catch (error: Exception) {
            trySend(Result.failure(error))
            close()
        }

        awaitClose { registration?.remove() }
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

    suspend fun searchPublicProfiles(query: String): Result<List<PublicProfile>> = runCatching {
        val uid = requireUid()
        val term = query.trim()
        require(term.length >= 2) { "اكتب حرفين على الأقل للبحث" }
        firestore.collection("publicProfiles")
            .orderBy("displayName")
            .startAt(term)
            .endAt(term + "\uf8ff")
            .limit(20)
            .get()
            .await()
            .documents
            .filter { it.id != uid }
            .mapNotNull { doc ->
                val name = doc.getString("displayName")?.trim().orEmpty()
                if (name.isBlank()) null else PublicProfile(
                    uid = doc.id,
                    displayName = name,
                    photoPath = doc.getString("photoPath"),
                    city = doc.getString("city")
                )
            }
    }

    suspend fun createDirectConversation(otherUid: String): Result<String> = runCatching {
        val uid = requireUid()
        require(otherUid.isNotBlank() && otherUid != uid) { "المستخدم الآخر غير صالح" }
        val profile = firestore.collection("publicProfiles").document(otherUid).get().await()
        require(profile.exists()) { "هذا الحساب غير موجود في الملفات العامة" }

        val existing = firestore.collection("conversations")
            .whereArrayContains("participants", uid)
            .get()
            .await()
            .documents
            .firstOrNull { doc ->
                val members = (doc.get("participants") as? List<*>)?.filterIsInstance<String>()?.toSet()
                members == setOf(uid, otherUid)
            }
        if (existing != null) return@runCatching existing.id

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
