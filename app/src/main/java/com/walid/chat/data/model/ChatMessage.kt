package com.walid.chat.data.model

/**
 * A message stored in a conversation's Firestore messages subcollection.
 * Media paths are Storage object paths, never device-local file paths.
 */
data class ChatMessage(
    val id: String,
    val senderUid: String,
    val type: String,
    val text: String = "",
    val timestamp: String = "",
    val mediaPath: String? = null
)
