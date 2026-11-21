package com.walid.chat.data.repository

import okhttp3.Request
import org.json.JSONObject
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
            JSONObject().put("text", "مرحبا")
        )
        assertEquals("https://imi.example.test/api/v1/status", request.url.toString())
        assertEquals("Bearer firebase-id-token", request.header("Authorization"))
        assertEquals("application/json", request.header("Accept"))
        assertTrue(request.body!!.contentType().toString().startsWith("application/json"))
    }

    @Test
    fun rejectsMissingTokenAndNonHttpsBaseUrl() {
        try {
            ImiApiHttp.buildRequest("https://imi.example.test", "/api/v1/status", "", JSONObject())
            fail("Expected missing token to be rejected")
        } catch (error: IllegalArgumentException) {
            assertTrue(error.message!!.contains("جلسة Firebase"))
        }
        try {
            ImiApiHttp.buildRequest("http://imi.example.test", "/api/v1/status", "token", JSONObject())
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
        assertEquals("direct_123", data.getString("conversationId"))
    }

    @Test
    fun mapsUnauthorizedAndRateLimitToArabicErrors() {
        assertError("انتهت جلسة الدخول", 401, """{"error":"Unauthorized"}""")
        assertError("أرسلت طلبات كثيرة", 429, """{"error":"Too many requests"}""")
    }

    @Test
    fun preservesArabicServerValidationErrors() {
        assertError("انتظر قليلاً", 429, """{"error":"انتظر قليلاً قبل نشر حالة أخرى."}""")
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
