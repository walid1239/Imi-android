package com.walid.chat.ui

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.PersonAdd
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
import com.google.firebase.storage.FirebaseStorage
import com.walid.chat.data.model.Chat
import com.walid.chat.data.model.ChatMessage
import com.walid.chat.data.model.PublicProfile
import com.walid.chat.data.repository.FirebaseChatRepository
import com.walid.chat.data.repository.FirebaseChatRepositoryFactory
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

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
    var hasOlderMessages by remember { mutableStateOf(false) }
    var loadingOlder by remember { mutableStateOf(false) }
    var selectedChat by remember { mutableStateOf<Chat?>(null) }
    var draft by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var showSearch by remember { mutableStateOf(false) }
    var searchText by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<PublicProfile>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var creatingChatUid by remember { mutableStateOf<String?>(null) }
    var searchError by remember { mutableStateOf<String?>(null) }

    val mediaPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val chatId = selectedChat?.id
        val repo = repository
        if (uri != null && chatId != null && repo != null && !sending) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            var fileName = "attachment"
            var sizeBytes = -1L
            context.contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
                null,
                null,
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIndex >= 0) fileName = cursor.getString(nameIndex) ?: fileName
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) sizeBytes = cursor.getLong(sizeIndex)
                }
            }
            val contentType = context.contentResolver.getType(uri).orEmpty()
            sending = true
            errorText = null
            scope.launch {
                repo.sendMediaMessage(chatId, uri, contentType, fileName, sizeBytes).fold(
                    onSuccess = { errorText = null },
                    onFailure = { errorText = it.localizedMessage ?: "تعذر إرسال المرفق" }
                )
                sending = false
            }
        }
    }

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
            hasOlderMessages = false
        } else {
            messages = emptyList()
            hasOlderMessages = true
            repo.observeMessages(chat.id).collect { result ->
                result.fold(
                    onSuccess = { latest ->
                        val latestIds = latest.mapTo(mutableSetOf()) { it.id }
                        messages = (messages.filterNot { it.id in latestIds } + latest)
                            .distinctBy { it.id }
                            .sortedWith(compareBy<ChatMessage> { it.createdAt?.toDate()?.time ?: Long.MIN_VALUE }.thenBy { it.id })
                        if (latest.size < 50) hasOlderMessages = false
                        errorText = null
                    },
                    onFailure = { errorText = it.localizedMessage ?: "تعذر مزامنة الرسائل" }
                )
            }
        }
    }

    fun loadOlderMessages() {
        val chat = selectedChat ?: return
        val repo = repository ?: return
        val oldest = messages.firstOrNull() ?: return
        if (loadingOlder || !hasOlderMessages) return
        loadingOlder = true
        scope.launch {
            repo.loadOlderMessages(chat.id, oldest).fold(
                onSuccess = { older ->
                    val knownIds = messages.mapTo(mutableSetOf()) { it.id }
                    messages = (older.filterNot { it.id in knownIds } + messages)
                        .distinctBy { it.id }
                        .sortedWith(compareBy<ChatMessage> { it.createdAt?.toDate()?.time ?: Long.MIN_VALUE }.thenBy { it.id })
                    hasOlderMessages = older.size == 50
                },
                onFailure = { errorText = it.localizedMessage ?: "تعذر تحميل الرسائل الأقدم" }
            )
            loadingOlder = false
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
                IconButton(onClick = { showSearch = true; searchText = ""; searchResults = emptyList(); searchError = null }) {
                    Icon(Icons.Filled.PersonAdd, "محادثة جديدة", tint = CloudBlue)
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
                if (hasOlderMessages && messages.isNotEmpty()) item {
                    TextButton(
                        enabled = !loadingOlder,
                        onClick = { loadOlderMessages() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (loadingOlder) "جارٍ تحميل الأقدم…" else "تحميل رسائل أقدم", color = CloudBlue)
                    }
                }
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
                            Column(Modifier.padding(horizontal = 13.dp, vertical = 9.dp)) {
                                if (item.text.isNotBlank()) {
                                    Text(item.text, color = CloudText)
                                } else if (item.type != "text") {
                                    Text("مرفق: ${item.type}", color = CloudText)
                                }
                                if (item.mediaPath != null) {
                                    var downloadUrl by remember(item.id) { mutableStateOf<String?>(null) }
                                    var mediaLoadFailed by remember(item.id) { mutableStateOf(false) }
                                    LaunchedEffect(item.mediaPath) {
                                        try {
                                            downloadUrl = FirebaseStorage.getInstance().reference
                                                .child(item.mediaPath)
                                                .downloadUrl
                                                .await()
                                                .toString()
                                        } catch (_: Exception) {
                                            mediaLoadFailed = true
                                        }
                                    }
                                    if (downloadUrl != null) {
                                        TextButton(onClick = {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)))
                                        }) {
                                            Text("فتح ${item.fileName ?: "المرفق"}", color = CloudText)
                                        }
                                    } else {
                                        Text(
                                            if (mediaLoadFailed) "تعذر تحميل المرفق" else "جارٍ تجهيز المرفق…",
                                            color = CloudMuted,
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                if (messages.isEmpty()) item {
                    Text("لا توجد رسائل بعد.", color = CloudMuted, modifier = Modifier.padding(20.dp))
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    enabled = selectedChat != null && !sending,
                    onClick = {
                        mediaPicker.launch(arrayOf(
                            "image/jpeg", "image/png", "image/webp",
                            "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm",
                            "video/mp4", "video/webm"
                        ))
                    }
                ) { Icon(Icons.Filled.AttachFile, "إرفاق صورة أو صوت أو فيديو", tint = CloudBlue) }
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
        if (showSearch) {
            AlertDialog(
                onDismissRequest = { if (creatingChatUid == null) showSearch = false },
                containerColor = CloudSurface,
                title = { Text("بدء محادثة جديدة", color = CloudText, fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = searchText,
                            onValueChange = { searchText = it; searchError = null },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = { Text("اسم المستخدم") },
                            placeholder = { Text("اكتب حرفين على الأقل") },
                            enabled = !searching && creatingChatUid == null
                        )
                        searchError?.let { Text(it, color = Color(0xFFFFA0A0), fontSize = 12.sp) }
                        if (searching) LinearProgressIndicator(Modifier.fillMaxWidth(), color = CloudBlue)
                        LazyColumn(
                            modifier = Modifier.fillMaxWidth().heightIn(max = 260.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(searchResults, key = { it.uid }) { profile ->
                                Row(
                                    Modifier.fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable(enabled = creatingChatUid == null) {
                                            val repo = repository
                                            if (repo != null) {
                                                creatingChatUid = profile.uid
                                                scope.launch {
                                                    repo.createDirectConversation(profile.uid).fold(
                                                        onSuccess = { chatId ->
                                                            val chat = Chat(
                                                                id = chatId,
                                                                title = profile.displayName,
                                                                lastMessage = "",
                                                                timestamp = "",
                                                                unreadCount = 0
                                                            )
                                                            chats = listOf(chat) + chats.filterNot { it.id == chatId }
                                                            selectedChat = chat
                                                            showSearch = false
                                                            errorText = null
                                                        },
                                                        onFailure = { searchError = it.localizedMessage ?: "تعذر إنشاء المحادثة" }
                                                    )
                                                    creatingChatUid = null
                                                }
                                            }
                                        }
                                        .padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        Modifier.size(36.dp).clip(CircleShape).background(CloudBlue.copy(alpha = .2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(profile.displayName.take(1), color = CloudText, fontWeight = FontWeight.Bold)
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(profile.displayName, color = CloudText, fontWeight = FontWeight.SemiBold)
                                        profile.city?.takeIf { it.isNotBlank() }?.let {
                                            Text(it, color = CloudMuted, fontSize = 11.sp)
                                        }
                                    }
                                    if (creatingChatUid == profile.uid) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(18.dp),
                                            color = CloudBlue,
                                            strokeWidth = 2.dp
                                        )
                                    }
                                }
                            }
                        }
                        if (!searching && searchText.trim().length >= 2 && searchResults.isEmpty() && searchError == null) {
                            Text("لا توجد نتائج مطابقة.", color = CloudMuted, fontSize = 12.sp)
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = searchText.trim().length >= 2 && !searching && creatingChatUid == null,
                        onClick = {
                            val repo = repository
                            if (repo != null) scope.launch {
                                searching = true
                                searchError = null
                                repo.searchPublicProfiles(searchText).fold(
                                    onSuccess = { searchResults = it },
                                    onFailure = { searchError = it.localizedMessage ?: "تعذر البحث عن المستخدمين" }
                                )
                                searching = false
                            } else {
                                searchError = "الاتصال السحابي غير متاح"
                            }
                        }
                    ) { Text("بحث", color = CloudBlue) }
                },
                dismissButton = {
                    TextButton(
                        enabled = creatingChatUid == null,
                        onClick = { showSearch = false }
                    ) { Text("إغلاق", color = CloudMuted) }
                }
            )
        }
    }
}
