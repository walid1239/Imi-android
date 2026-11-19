package com.walid.chat.data.repository

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DirectConversationIdTest {
    @Test
    fun idIsSymmetricForBothParticipants() {
        assertEquals(
            DirectConversationId.forUsers("alice", "bob"),
            DirectConversationId.forUsers("bob", "alice")
        )
    }

    @Test
    fun idIsStableAndDifferentForDifferentPairs() {
        val first = DirectConversationId.forUsers("alice", "bob")
        assertEquals(first, DirectConversationId.forUsers("alice", "bob"))
        assertNotEquals(first, DirectConversationId.forUsers("alice", "mallory"))
    }

    @Test
    fun lengthPrefixKeepsSeparatorLikeCharactersUnambiguous() {
        assertNotEquals(
            DirectConversationId.forUsers("a_b", "c"),
            DirectConversationId.forUsers("a", "b_c")
        )
    }

    @Test
    fun rejectsBlankOrIdenticalParticipants() {
        assertThrows(IllegalArgumentException::class.java) {
            DirectConversationId.forUsers("", "bob")
        }
        assertThrows(IllegalArgumentException::class.java) {
            DirectConversationId.forUsers("alice", "alice")
        }
    }
}
