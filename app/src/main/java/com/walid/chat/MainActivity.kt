package com.walid.chat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import com.walid.chat.data.repository.FirebaseSessionRepository
import com.walid.chat.ui.IMIApp
import com.walid.chat.ui.theme.IMITheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        var cloudSessionMessage by mutableStateOf("جارٍ تهيئة الاتصال السحابي…")
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    FirebaseSessionRepository.create(applicationContext)
                        .ensureSignedIn()
                        .getOrThrow()
                }
            }
            cloudSessionMessage = result.fold(
                onSuccess = { "جلسة Firebase مؤقتة • غير موثقة • UID: ${it.take(8)}…" },
                onFailure = { "السحابة غير مهيأة: ${it.message ?: "تحقق من إعداد Firebase"}" }
            )
        }

        setContent {
            IMITheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    IMIApp(cloudSessionMessage = cloudSessionMessage)
                }
            }
        }
    }
}
