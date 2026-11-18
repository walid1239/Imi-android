package com.walid.chat.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.walid.chat.ui.theme.IMITheme

@Composable
fun IMIApp() {
    var selected by remember { mutableStateOf("المحادثات") }
    IMITheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(
                modifier = Modifier.fillMaxSize().padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Text("IMI", style = MaterialTheme.typography.headlineLarge)
                Text("تطبيق اجتماعي عربي — نسخة تأسيسية", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("المحادثات", "الحالات", "Reels", "المكالمات", "الملف").forEach { tab ->
                        TextButton(onClick = { selected = tab }) { Text(tab) }
                    }
                }
                Text(selected, style = MaterialTheme.typography.headlineSmall)
                Text("الواجهة الأصلية Native مبنية بـ Kotlin وJetpack Compose. الخدمات الخلفية لم تُفعّل بعد.")
            }
        }
    }
}
