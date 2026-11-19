package com.walid.chat.data.repository

import com.walid.chat.data.model.Chat
import com.walid.chat.data.model.ChatMessage
import kotlinx.coroutines.flow.Flow

/**
 * Contract for the chat data source. Implementations must not silently fall back
 * to device-local persistence when cloud operations fail.
 */
interface ChatRepository {
    suspend fun getChats(): Result<List<Chat>>
    fun observeMessages(chatId: String): Flow<Result<List<ChatMessage>>>
    suspend fun loadOlderMessages(chatId: String, before: ChatMessage): Result<List<ChatMessage>>
    suspend fun sendMessage(chatId: String, text: String): Result<Unit>
}
