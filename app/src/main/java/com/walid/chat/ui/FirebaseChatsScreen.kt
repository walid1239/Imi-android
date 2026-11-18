package com.walid.chat.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.walid.chat.data.model.Chat
import com.walid.chat.data.model.ChatMessage
import com.walid.chat.data.repository.FirebaseChatRepository
import com.walid.chat.data.repository.FirebaseChatRepositoryFactory
import kotlinx.coroutines.launch

private val CloudBg = Color(0xFF07090F)
private val CloudSurface = Color(0xFF171E2D)
private val CloudBlue = Color(0xFF3D6BFF)
private val CloudText = Color(0xFFF4F6FC)
private val CloudMuted = Color(0xFF929BB0)

@Composable
internal fun FirebaseChatsScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var repository by remember { mutableStateOf<FirebaseChatRepository?>(null) }
    var chats by remember { mutableStateOf<List<Chat>>(emptyList()) }
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var selectedChat by remember { mutableStateOf<Chat?>(null) }
    var draft by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            if (FirebaseApp.getApps(context.applicationContext).isEmpty()) {
                errorText = "Firebase غير مهيأ. يلزم إضافة google-services.json."
            } else {
                val repo = FirebaseChatRepositoryFactory.create(context)
                repository = repo
                repo.getChats().fold(
                    onSuccess = { chats = it; errorText = null },
                    onFailure = { errorText = it.localizedMessage ?: "تعذر تحميل المحادثات" }
                )
            }
        } catch (t: Throwable) {
            errorText = t.localizedMessage ?: "تعذر تهيئة المحادثات السحابية"
        } finally {
            loading = false
        }
    }

    LaunchedEffect(selectedChat?.id, repository) {
        val chat = selectedChat
        val repo = repository
        if (chat == null || repo == null) {
            messages = emptyList()
        } else {
            repo.observeMessages(chat.id).collect { result ->
                result.fold(
                    onSuccess = { messages = it; errorText = null },
                    onFailure = { errorText = it.localizedMessage ?: "تعذر مزامنة الرسائل" }
                )
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(CloudBg).padding(horizontal = 18.dp, vertical = 18.dp)
    ) {
        if (selectedChat == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("المحادثات", color = CloudText, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                    Text("محادثاتك المتزامنة عبر السحابة", color = CloudMuted, fontSize = 12.sp)
                }
                IconButton(onClick = {
                    val repo = repository
                    if (repo != null) scope.launch {
                        loading = true
                        repo.getChats().fold(
                            onSuccess = { chats = it; errorText = null },
                            onFailure = { errorText = it.localizedMessage ?: "تعذر تحديث القائمة" }
                        )
                        loading = false
                    }
                }) { Icon(Icons.Filled.Refresh, "تحديث", tint = CloudBlue) }
            }
            Spacer(Modifier.height(14.dp))
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = CloudBlue)
            errorText?.let {
                Text(it, color = Color(0xFFFFA0A0), fontSize = 12.sp, modifier = Modifier.padding(vertical = 8.dp))
            }
            if (!loading && chats.isEmpty() && errorText == null) {
                Text("لا توجد محادثات سحابية بعد.", color = CloudMuted, modifier = Modifier.padding(vertical = 24.dp))
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(chats, key = { it.id }) { chat ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                            .clickable { selectedChat = chat; errorText = null }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier.size(46.dp).clip(CircleShape).background(CloudBlue.copy(alpha = .2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(chat.title.take(1), color = CloudText, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(chat.title, color = CloudText, fontWeight = FontWeight.SemiBold)
                            Text(chat.lastMessage.ifBlank { "ابدأ المحادثة" }, color = CloudMuted, fontSize = 12.sp, maxLines = 1)
                        }
                    }
                }
            }
            Text(
                "تعرض هذه الشاشة بيانات Firestore فقط؛ لا تُخلط الرسائل المحلية بالمحادثات السحابية.",
                color = CloudMuted, fontSize = 10.sp
            )
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { selectedChat = null; errorText = null }) {
                    Icon(Icons.Filled.ArrowForward, "رجوع", tint = CloudText)
                }
                Text(selectedChat?.title ?: "محادثة", color = CloudText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            errorText?.let { Text(it, color = Color(0xFFFFA0A0), fontSize = 12.sp) }
            LazyColumn(
                Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(messages, key = { it.id }) { item ->
                    val ownUid = FirebaseAuth.getInstance().currentUser?.uid
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = if (item.senderUid == ownUid) Arrangement.End else Arrangement.Start
                    ) {
                        Surface(
                            color = if (item.senderUid == ownUid) CloudBlue.copy(alpha = .22f) else CloudSurface,
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text(
                                item.text.ifBlank { if (item.type == "text") "" else "مرفق: " + item.type },
                                color = CloudText,
                                modifier = Modifier.padding(horizontal = 13.dp, vertical = 9.dp)
                            )
                        }
                    }
                }
                if (messages.isEmpty()) item {
                    Text("لا توجد رسائل بعد.", color = CloudMuted, modifier = Modifier.padding(20.dp))
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it.take(1000) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("اكتب رسالة…") },
                    singleLine = true,
                    enabled = !sending
                )
                IconButton(
                    enabled = draft.isNotBlank() && !sending,
                    onClick = {
                        val textToSend = draft.trim()
                        val chatId = selectedChat?.id ?: return@IconButton
                        val repo = repository ?: return@IconButton
                        sending = true
                        scope.launch {
                            repo.sendMessage(chatId, textToSend).fold(
                                onSuccess = { draft = ""; errorText = null },
                                onFailure = { errorText = it.localizedMessage ?: "تعذر إرسال الرسالة" }
                            )
                            sending = false
                        }
                    }
                ) { Icon(Icons.Filled.Send, "إرسال", tint = CloudBlue) }
            }
        }
    }
}
