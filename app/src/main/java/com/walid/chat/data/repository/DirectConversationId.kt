package com.walid.chat.data.repository

import java.security.MessageDigest

/**
 * Stable, symmetric document ID for a direct conversation shared by Android and web.
 * Length-prefixing avoids ambiguous pairs when a UID contains a separator character.
 */
internal object DirectConversationId {
    fun forUsers(firstUid: String, secondUid: String): String {
        require(firstUid.isNotBlank() && secondUid.isNotBlank() && firstUid != secondUid) {
            "معرّفا المستخدمين غير صالحين"
        }
        val canonicalPair = listOf(firstUid, secondUid)
            .sorted()
            .joinToString(separator = "") { "${it.length}:$it" }
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(canonicalPair.toByteArray(Charsets.UTF_8))
        val hash = digest.joinToString("") { byte ->
            (byte.toInt() and 0xff).toString(16).padStart(2, '0')
        }
        return "direct_$hash"
    }
}
