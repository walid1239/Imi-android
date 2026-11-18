package com.walid.chat.core

import org.junit.Assert.assertEquals
import org.junit.Test

class FeatureStatusTest {
    @Test
    fun featureStatusesRemainExplicit() {
        assertEquals(
            setOf("UI_READY", "BACKEND_NOT_CONFIGURED", "NOT_IMPLEMENTED"),
            FeatureStatus.entries.map { it.name }.toSet()
        )
    }

    @Test
    fun destinationsExposeExpectedArabicSections() {
        assertEquals(
            listOf("الرئيسية", "الحالات", "Reels", "الأكاديمية", "المكالمات", "حسابي"),
            ImiDestination.entries.map { it.title }
        )
    }
}
