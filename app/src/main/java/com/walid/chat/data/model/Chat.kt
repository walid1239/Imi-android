package com.walid.chat.data.model

data class Chat(
    val id: String,
    val title: String,
    val lastMessage: String,
    val timestamp: String,
    val unreadCount: Int = 0
)
