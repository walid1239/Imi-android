package com.walid.chat.data.repository

import com.walid.chat.data.model.Chat
import com.walid.chat.data.model.ChatMessage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class UnconfiguredChatRepository : ChatRepository {
    override suspend fun getChats(): Result<List<Chat>> =
        Result.failure(IllegalStateException("مصدر المحادثات غير مربوط بعد"))

    override fun observeMessages(chatId: String): Flow<Result<List<ChatMessage>>> = flow {
        emit(Result.failure(IllegalStateException("مزامنة الرسائل غير مفعّلة قبل ربط Firebase")))
    }

    override suspend fun sendMessage(chatId: String, text: String): Result<Unit> =
        Result.failure(IllegalStateException("إرسال الرسائل غير مفعّل قبل ربط Firebase"))
}
