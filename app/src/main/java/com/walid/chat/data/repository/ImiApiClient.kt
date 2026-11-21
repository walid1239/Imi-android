package com.walid.chat.data.repository

import com.walid.chat.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

/** Bearer-authenticated client for the IMI server API. */
class ImiApiClient(
    baseUrl: String = BuildConfig.IMI_API_BASE_URL,
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    private val baseUrl = baseUrl.trim().trimEnd('/')

    suspend fun post(path: String, idToken: String, payload: JSONObject): JSONObject =
        withContext(Dispatchers.IO) {
            val request = ImiApiHttp.buildRequest(baseUrl, path, idToken, payload)
            httpClient.newCall(request).execute().use { response ->
                ImiApiHttp.parseResponse(response.code, response.body?.string().orEmpty())
            }
        }
}

internal object ImiApiHttp {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    fun buildRequest(baseUrl: String, path: String, idToken: String, payload: JSONObject): Request {
        require(idToken.isNotBlank()) { "جلسة Firebase غير صالحة؛ أعد تسجيل الدخول." }
        require(path.startsWith("/api/v1/")) { "مسار API غير صالح." }
        val root = baseUrl.toHttpUrlOrNull()
            ?: throw IllegalStateException("عنوان خادم IMI غير مضبوط. أعد البناء مع IMI_API_BASE_URL.")
        require(root.isHttps) { "يجب أن يستخدم خادم IMI اتصال HTTPS." }
        val url = root.newBuilder().addPathSegments(path.removePrefix("/")).build()
        return Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $idToken")
            .header("Accept", "application/json")
            .post(payload.toString().toRequestBody(jsonMediaType))
            .build()
    }

    fun parseResponse(statusCode: Int, responseBody: String): JSONObject {
        val json = try {
            JSONObject(responseBody)
        } catch (_: Exception) {
            throw IOException("تعذر فهم استجابة خادم IMI (HTTP $statusCode).")
        }
        if (statusCode !in 200..299 || !json.optBoolean("ok", false)) {
            val serverMessage = json.optString("error").trim()
            val message = when {
                Regex("[\\u0600-\\u06FF]").containsMatchIn(serverMessage) -> serverMessage
                statusCode == 401 -> "انتهت جلسة الدخول؛ أعد تسجيل الدخول ثم حاول مجدداً."
                statusCode == 403 -> "ليست لديك صلاحية لتنفيذ هذا الإجراء."
                statusCode == 404 -> "الخدمة المطلوبة غير متاحة على خادم IMI."
                statusCode == 409 -> "تعذر إتمام الطلب بسبب تعارض في البيانات."
                statusCode == 413 -> "حجم الطلب أكبر من الحد المسموح."
                statusCode == 429 -> "أرسلت طلبات كثيرة؛ انتظر قليلاً ثم حاول."
                statusCode >= 500 -> "خادم IMI يواجه مشكلة مؤقتة؛ حاول لاحقاً."
                else -> "رفض خادم IMI الطلب (HTTP $statusCode)."
            }
            throw IOException(message)
        }
        return json.optJSONObject("data")
            ?: throw IOException("استجابة خادم IMI لا تحتوي على بيانات صالحة.")
    }
}
