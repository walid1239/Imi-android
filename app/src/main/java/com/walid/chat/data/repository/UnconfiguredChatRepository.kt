package com.walid.chat.data.repository

import com.walid.chat.data.model.Chat

class UnconfiguredChatRepository : ChatRepository {
    override suspend fun getChats(): Result<List<Chat>> =
        Result.failure(IllegalStateException("مصدر المحادثات غير مربوط بعد"))

    override suspend fun sendMessage(chatId: String, text: String): Result<Unit> =
        Result.failure(IllegalStateException("إرسال الرسائل غير مفعّل قبل ربط Firebase"))
}
