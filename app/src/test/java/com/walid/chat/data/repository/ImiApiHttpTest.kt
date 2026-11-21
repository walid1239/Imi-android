package com.walid.chat.data.repository

import okhttp3.Request
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.IOException

class ImiApiHttpTest {
    @Test
    fun buildsHttpsBearerJsonRequest() {
        val request: Request = ImiApiHttp.buildRequest(
            "https://imi.example.test/",
            "/api/v1/status",
            "firebase-id-token",
            """{"text":"مرحبا"}"""
        )
        assertEquals("https://imi.example.test/api/v1/status", request.url.toString())
        assertEquals("Bearer firebase-id-token", request.header("Authorization"))
        assertEquals("application/json", request.header("Accept"))
        assertTrue(request.body!!.contentType().toString().startsWith("application/json"))
        val body = Buffer()
        request.body!!.writeTo(body)
        assertEquals("""{"text":"مرحبا"}""", body.readUtf8())
    }

    @Test
    fun rejectsMissingTokenAndNonHttpsBaseUrl() {
        try {
            ImiApiHttp.buildRequest("https://imi.example.test", "/api/v1/status", "", """{}""")
            fail("Expected missing token to be rejected")
        } catch (error: IllegalArgumentException) {
            assertTrue(error.message!!.contains("جلسة Firebase"))
        }
        try {
            ImiApiHttp.buildRequest("http://imi.example.test", "/api/v1/status", "token", """{}""")
            fail("Expected non-HTTPS URL to be rejected")
        } catch (error: IllegalArgumentException) {
            assertTrue(error.message!!.contains("HTTPS"))
        }
    }

    @Test
    fun extractsSuccessfulDataEnvelope() {
        val data = ImiApiHttp.parseResponse(
            200,
            """{"ok":true,"data":{"conversationId":"direct_123"}}"""
        )
        assertEquals("direct_123", data.get("conversationId").asString)
    }

    @Test
    fun mapsUnauthorizedAndRateLimitToArabicErrors() {
        assertError("انتهت جلسة الدخول", 401, """{"ok":false,"error":"Unauthorized"}""")
        assertError("أرسلت طلبات كثيرة", 429, """{"ok":false,"error":"Too many requests"}""")
    }

    @Test
    fun preservesArabicServerValidationErrors() {
        assertError("انتظر قليلاً", 429, """{"ok":false,"error":"انتظر قليلاً قبل نشر حالة أخرى."}""")
    }

    private fun assertError(expected: String, status: Int, body: String) {
        try {
            ImiApiHttp.parseResponse(status, body)
            fail("Expected HTTP error")
        } catch (error: IOException) {
            assertTrue(error.message!!.contains(expected))
        }
    }
}
