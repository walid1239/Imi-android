package com.walid.chat.data.repository

import com.walid.chat.data.model.Chat

/**
 * Contract for the chat data source.
 * A Firebase implementation should be added only after Firebase is configured
 * and Firestore security rules have been reviewed.
 */
interface ChatRepository {
    suspend fun getHats(): Result<List<Chat>>
    suspend fun sendMessage(chatId: String, text: String): Result<Unit>
}
