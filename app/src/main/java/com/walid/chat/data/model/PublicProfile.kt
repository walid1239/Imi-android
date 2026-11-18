package com.walid.chat.data.model

data class PublicProfile(
    val uid: String,
    val displayName: String,
    val photoPath: String? = null,
    val city: String? = null
)
