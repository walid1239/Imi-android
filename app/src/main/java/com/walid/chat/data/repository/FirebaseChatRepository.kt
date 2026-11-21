package com.walid.chat.data.repository

import android.content.Context
import android.net.Uri
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
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
    private val firestore: FirebaseFirestore,
    private val storage: FirebaseStorage
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
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .orderBy(FieldPath.documentId(), Query.Direction.DESCENDING)
                .limit(50)
                .addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        trySend(Result.failure(error))
                    } else if (snapshot != null) {
                        val messages = snapshot.documents.map { document ->
                            val createdAt = document.getTimestamp("createdAt")
                            ChatMessage(
                                id = document.id,
                                senderUid = document.getString("senderUid") ?: "",
                                type = document.getString("type") ?: "text",
                                text = document.getString("text") ?: "",
                                timestamp = createdAt?.toDate()?.toString() ?: "",
                                mediaPath = document.getString("mediaPath"),
                                contentType = document.getString("contentType"),
                                fileName = document.getString("fileName"),
                                createdAt = createdAt
                            )
                        }.reversed()
                        trySend(Result.success(messages))
                    }
                }
        } catch (error: Exception) {
            trySend(Result.failure(error))
            close()
        }

        awaitClose { registration?.remove() }
    }

    override suspend fun loadOlderMessages(
        chatId: String,
        before: ChatMessage
    ): Result<List<ChatMessage>> = runCatching {
        require(chatId.isNotBlank()) { "معرّف المحادثة غير صالح" }
        val cursor = before.createdAt ?: error("توقيت الرسالة غير متاح لتحميل الرسائل الأقدم")
        requireUid()
        firestore.collection("conversations")
            .document(chatId)
            .collection("messages")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .orderBy(FieldPath.documentId(), Query.Direction.DESCENDING)
            .startAfter(cursor, before.id)
            .limit(50)
            .get()
            .await()
            .documents
            .map { document ->
                val createdAt = document.getTimestamp("createdAt")
                ChatMessage(
                    id = document.id,
                    senderUid = document.getString("senderUid") ?: "",
                    type = document.getString("type") ?: "text",
                    text = document.getString("text") ?: "",
                    timestamp = createdAt?.toDate()?.toString() ?: "",
                    mediaPath = document.getString("mediaPath"),
                    contentType = document.getString("contentType"),
                    fileName = document.getString("fileName"),
                    createdAt = createdAt
                )
            }
            .reversed()
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
                "lastMessageId" to message.id,
                "lastMessageAt" to FieldValue.serverTimestamp(),
                "lastSenderUid" to uid
            ))
        }.await()
    }

    override suspend fun sendMediaMessage(
        chatId: String,
        uri: Uri,
        contentType: String,
        fileName: String,
        sizeBytes: Long,
        caption: String
    ): Result<Unit> = runCatching {
        require(chatId.isNotBlank()) { "معرّف المحادثة غير صالح" }
        val cleanCaption = caption.trim()
        require(cleanCaption.length <= 1_000) { "التعليق أطول من 1000 حرف" }
        val type = when {
            contentType.startsWith("image/") -> "image"
            contentType.startsWith("audio/") -> "audio"
            contentType.startsWith("video/") -> "video"
            else -> error("نوع المرفق غير مدعوم")
        }
        val allowed = when (type) {
            "image" -> contentType in setOf("image/jpeg", "image/png", "image/webp") && sizeBytes in 1..(10L * 1024 * 1024)
            "audio" -> contentType in setOf("audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm") && sizeBytes in 1..(20L * 1024 * 1024)
            else -> contentType in setOf("video/mp4", "video/webm") && sizeBytes in 1..(50L * 1024 * 1024)
        }
        require(allowed) { "نوع الملف غير مدعوم أو حجمه يتجاوز الحد المسموح" }

        val uid = requireUid()
        val conversation = firestore.collection("conversations").document(chatId)
        val message = conversation.collection("messages").document()
        val safeFileName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(100).ifBlank { "attachment" }
        val mediaPath = "conversations/$chatId/$uid/${message.id}/$safeFileName"
        val mediaReference = storage.reference.child(mediaPath)
        val metadata = StorageMetadata.Builder()
            .setContentType(contentType)
            .setCustomMetadata("ownerUid", uid)
            .setCustomMetadata("conversationId", chatId)
            .setCustomMetadata("messageId", message.id)
            .build()

        try {
            mediaReference.putFile(uri, metadata).await()
            val preview = cleanCaption.ifBlank {
                when (type) {
                    "image" -> "📷 صورة"
                    "audio" -> "🎤 رسالة صوتية"
                    else -> "🎬 فيديو"
                }
            }
            firestore.runBatch { batch ->
                batch.set(message, mapOf(
                    "senderUid" to uid,
                    "type" to type,
                    "text" to cleanCaption,
                    "mediaPath" to mediaPath,
                    "contentType" to contentType,
                    "fileName" to safeFileName,
                    "createdAt" to FieldValue.serverTimestamp()
                ))
                batch.update(conversation, mapOf(
                    "lastMessage" to preview,
                    "lastMessageId" to message.id,
                    "lastMessageAt" to FieldValue.serverTimestamp(),
                    "lastSenderUid" to uid
                ))
            }.await()
        } catch (error: Exception) {
            runCatching { mediaReference.delete().await() }
            throw error
        }
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

        // Server-authoritative: role restrictions, block checks and profile requirements.
        val idToken = auth.currentUser?.getIdToken(false)?.await()?.token
            ?: error("جلسة Firebase غير صالحة؛ أعد تسجيل الدخول.")
        val data = ImiApiClient().post(
            "/api/v1/conversations/direct",
            idToken,
            org.json.JSONObject().put("otherUid", otherUid)
        )
        val conversationId = data.optString("conversationId")
            .takeIf { it.isNotBlank() }
            ?: error("لم يُرجع الخادم معرّف المحادثة")
        require(conversationId.isNotBlank()) { "معرّف المحادثة فارغ" }
        conversationId
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
            FirebaseFirestore.getInstance(),
            FirebaseStorage.getInstance()
        )
    }
}
