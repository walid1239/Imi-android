package com.walid.chat.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.MediaItem
import androidx.media3.ui.PlayerView
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import org.json.JSONArray
import org.json.JSONObject
import com.walid.chat.ui.theme.IMITheme

private val ImiBackground = Color(0xFF07090F)
private val ImiSurface = Color(0xFF111522)
private val ImiSurface2 = Color(0xFF171E2D)
private val ImiBlue = Color(0xFF3D6BFF)
private val ImiPurple = Color(0xFF6C3DFF)
private val ImiText = Color(0xFFF4F6FC)
private val ImiMuted = Color(0xFF929BB0)
private val ImiGreen = Color(0xFF39C98A)

private enum class ImiTab(val label: String) {
    Home("الرئيسية"), Chats("المحادثات"), Reels("Reels"), Academy("الأكاديمية"), Profile("حسابي")
}

@Composable
fun IMIApp() {
    var selected by remember { mutableStateOf(ImiTab.Home) }
    IMITheme {
        Scaffold(
            containerColor = ImiBackground,
            bottomBar = { ImiBottomBar(selected) { selected = it } }
        ) { padding ->
            Box(Modifier.fillMaxSize().background(ImiBackground).padding(padding)) {
                when (selected) {
                    ImiTab.Home -> HomeScreen(
                        onChats = { selected = ImiTab.Chats },
                        onReels = { selected = ImiTab.Reels },
                        onAcademy = { selected = ImiTab.Academy }
                    )
                    ImiTab.Chats -> ChatsScreen()
                    ImiTab.Reels -> ReelsScreen()
                    ImiTab.Academy -> AcademyScreen()
                    ImiTab.Profile -> ProfileScreen()
                }
            }
        }
    }
}

@Composable
private fun ImiBottomBar(selected: ImiTab, onSelect: (ImiTab) -> Unit) {
    NavigationBar(containerColor = Color(0xFF0D111B), contentColor = ImiText, tonalElevation = 0.dp) {
        ImiTab.values().forEach { tab ->
            val icon = when (tab) {
                ImiTab.Home -> Icons.Filled.Home
                ImiTab.Chats -> Icons.Filled.ChatBubble
                ImiTab.Reels -> Icons.Filled.PlayCircle
                ImiTab.Academy -> Icons.Filled.School
                ImiTab.Profile -> Icons.Filled.Person
            }
            NavigationBarItem(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                icon = { Icon(icon, contentDescription = tab.label) },
                label = { Text(tab.label, fontSize = 10.sp, maxLines = 1) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = ImiBlue,
                    selectedTextColor = ImiText,
                    indicatorColor = ImiBlue.copy(alpha = .15f),
                    unselectedIconColor = ImiMuted,
                    unselectedTextColor = ImiMuted
                )
            )
        }
    }
}

@Composable
private fun PageHeader(title: String, subtitle: String? = null, action: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = ImiText, fontSize = 25.sp, fontWeight = FontWeight.Bold)
            if (subtitle != null) Text(subtitle, color = ImiMuted, fontSize = 12.sp)
        }
        if (action != null) action()
    }
}

@Composable
private fun IconAction(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, onClick: () -> Unit = {}) {
    Surface(
        modifier = Modifier.size(42.dp).clip(CircleShape).clickable { onClick() },
        color = ImiSurface2,
        shape = CircleShape
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = description, tint = ImiText, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun HomeScreen(onChats: () -> Unit, onReels: () -> Unit, onAcademy: () -> Unit) {
    var showNotifications by remember { mutableStateOf(false) }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            PageHeader("IMI", "مساحتك للتواصل والتعلّم") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconAction(Icons.Filled.Search, "بحث في المحادثات", onChats)
                    IconAction(Icons.Filled.NotificationsNone, "الإشعارات") { showNotifications = true }
                }
            }
        }
        item { WelcomeCard() }
        item { StoriesSection() }
        item {
            SectionHeader("مساحة التواصل", "عرض المحادثات", onChats)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FeatureTile("المحادثات", "تواصل مع أصدقائك", Icons.Filled.ChatBubble, ImiBlue, Modifier.weight(1f), onChats)
                FeatureTile("مقاطع Reels", "اكتشف محتوى جديداً", Icons.Filled.PlayCircle, ImiPurple, Modifier.weight(1f), onReels)
            }
        }
        item {
            SectionHeader("IMI Academy", "اكتشف الدروس", onAcademy)
            Surface(color = ImiSurface, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth().clickable { onAcademy() }) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(48.dp).clip(RoundedCornerShape(15.dp)).background(ImiPurple.copy(alpha = .2f)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.School, null, tint = Color(0xFFB69BFF), modifier = Modifier.size(26.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("تعلّم وشارك المعرفة", color = ImiText, fontWeight = FontWeight.SemiBold)
                        Text("مساحة تعليمية داخل IMI", color = ImiMuted, fontSize = 12.sp)
                    }
                    Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                }
            }
        }
        item { Text("هذه واجهة أولية محلية؛ الحسابات والرسائل والوسائط والمكالمات لم تُربط بخدمات خلفية بعد.", color = ImiMuted, fontSize = 11.sp) }
    }
    if (showNotifications) {
        AlertDialog(
            onDismissRequest = { showNotifications = false },
            title = { Text("الإشعارات") },
            text = {
                Text(
                    "لا توجد إشعارات جديدة حالياً. ستظهر هنا تنبيهات الرسائل والتفاعلات بعد ربط خدمات IMI.",
                    color = ImiMuted
                )
            },
            confirmButton = {
                TextButton(onClick = { showNotifications = false }) { Text("حسناً") }
            }
        )
    }
}

@Composable
private fun WelcomeCard() {
    Surface(
        color = ImiSurface,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(Modifier.background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Color(0xFF172B5C), Color(0xFF21143D), ImiSurface)))) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("أهلاً بك في IMI", color = ImiText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("كل ما يقرّبك من أصدقائك ويمنحك مساحة للتعلّم والإبداع.", color = Color(0xFFD0D7E8), fontSize = 13.sp, lineHeight = 20.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = ImiBlue, shape = RoundedCornerShape(30.dp)) {
                        Row(Modifier.padding(horizontal = 13.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Explore, null, tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("اكتشف IMI", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StoriesSection() {
    val context = LocalContext.current
    val prefs = remember(context) {
        context.getSharedPreferences("imi_local_status", android.content.Context.MODE_PRIVATE)
    }
    var statusText by remember(prefs) { mutableStateOf(prefs.getString("text", null)) }
    var statusImageUri by remember(prefs) { mutableStateOf(prefs.getString("image_uri", null)) }
    var expiresAt by remember(prefs) { mutableStateOf(prefs.getLong("expires_at", 0L)) }
    var showComposer by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    var draftImageUri by remember { mutableStateOf<String?>(null) }
    val statusImagePicker = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            draftImageUri = uri.toString()
        }
    }
    val statusImageBitmap = remember(statusImageUri) {
        statusImageUri?.let { savedUri ->
            runCatching {
                context.contentResolver.openInputStream(android.net.Uri.parse(savedUri))?.use { stream ->
                    android.graphics.BitmapFactory.decodeStream(stream)
                }
            }.getOrNull()
        }
    }
    val draftImageBitmap = remember(draftImageUri) {
        draftImageUri?.let { savedUri ->
            runCatching {
                context.contentResolver.openInputStream(android.net.Uri.parse(savedUri))?.use { stream ->
                    android.graphics.BitmapFactory.decodeStream(stream)
                }
            }.getOrNull()
        }
    }

    LaunchedEffect(expiresAt, statusText, statusImageUri) {
        if ((statusText != null || statusImageUri != null) && expiresAt > 0L) {
            val remainingMillis = expiresAt - System.currentTimeMillis()
            if (remainingMillis > 0L) kotlinx.coroutines.delay(remainingMillis)
            if (System.currentTimeMillis() >= expiresAt) {
                prefs.edit().clear().apply()
                statusText = null
                statusImageUri = null
                expiresAt = 0L
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("الحالات", if (statusText == null && statusImageUri == null) "أضف حالتك" else "حالتي", { showComposer = true })
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(58.dp).clickable { showComposer = true }
            ) {
                Box(Modifier.size(54.dp).clip(CircleShape).background(ImiSurface2), contentAlignment = Alignment.Center) {
                    if (statusText == null && statusImageUri == null) Icon(Icons.Filled.Add, null, tint = ImiBlue, modifier = Modifier.size(25.dp))
                    else Text("أنا", color = ImiText, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(5.dp))
                Text(if (statusText == null && statusImageUri == null) "أضف حالة" else "حالتي", color = ImiMuted, fontSize = 10.sp, maxLines = 1)
            }
            StoryBubble("أحمد", false, ImiPurple)
            StoryBubble("سارة", false, Color(0xFFE27B9B))
            StoryBubble("يوسف", false, Color(0xFF3AAE9B))
            StoryBubble("مريم", false, Color(0xFFE1A34B))
        }
        if (statusText != null || statusImageUri != null) {
            if (statusText != null) Text(statusText!!, color = ImiMuted, fontSize = 12.sp, maxLines = 2)
            if (statusImageBitmap != null) {
                Image(
                    bitmap = statusImageBitmap.asImageBitmap(),
                    contentDescription = "صورة الحالة",
                    modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp).clip(RoundedCornerShape(16.dp))
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("تنتهي حالتك بعد 28 ساعة من نشرها على هذا الجهاز.", color = ImiMuted, fontSize = 10.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = {
                    prefs.edit().clear().apply()
                    statusText = null
                    statusImageUri = null
                    expiresAt = 0L
                }, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp)) {
                    Text("حذف الحالة", color = Color(0xFFFF6685), fontSize = 11.sp)
                }
            }
        }
    }
    if (showComposer) {
        AlertDialog(
            onDismissRequest = { showComposer = false },
            title = { Text("إضافة حالة") },
            text = {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = { Text("ماذا تريد أن تشارك؟") },
                    maxLines = 4
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { statusImagePicker.launch(arrayOf("image/*")) }) {
                        Icon(Icons.Filled.Image, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (draftImageUri == null) "إرفاق صورة" else "تغيير الصورة")
                    }
                    if (draftImageBitmap != null) {
                        Image(
                            bitmap = draftImageBitmap.asImageBitmap(),
                            contentDescription = "معاينة صورة الحالة",
                            modifier = Modifier.fillMaxWidth().heightIn(max = 150.dp).clip(RoundedCornerShape(12.dp))
                        )
                        TextButton(onClick = { draftImageUri = null }) { Text("إزالة الصورة") }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val value = draft.trim()
                    if (value.isNotEmpty() || draftImageUri != null) {
                        val expiry = System.currentTimeMillis() + 28L * 60L * 60L * 1000L
                        prefs.edit().putString("text", value.takeIf { it.isNotEmpty() })
                            .putString("image_uri", draftImageUri)
                            .putLong("expires_at", expiry).apply()
                        statusText = value.takeIf { it.isNotEmpty() }
                        statusImageUri = draftImageUri
                        expiresAt = expiry
                        draft = ""
                        draftImageUri = null
                        showComposer = false
                    }
                }, enabled = draft.isNotBlank() || draftImageUri != null) { Text("نشر") }
            },
            dismissButton = {
                TextButton(onClick = { showComposer = false }) { Text("إلغاء") }
            }
        )
    }
}

@Composable
private fun StoryBubble(name: String, add: Boolean, tint: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(58.dp)) {
        Box(Modifier.size(54.dp).clip(CircleShape).background(if (add) ImiSurface2 else tint.copy(alpha = .22f)), contentAlignment = Alignment.Center) {
            if (add) Icon(Icons.Filled.Add, null, tint = ImiBlue, modifier = Modifier.size(25.dp))
            else Text(name.take(1), color = ImiText, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            if (!add) Box(Modifier.align(Alignment.BottomEnd).padding(2.dp).size(11.dp).clip(CircleShape).background(ImiGreen))
        }
        Spacer(Modifier.height(5.dp))
        Text(name, color = ImiMuted, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun SectionHeader(title: String, action: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = ImiText, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        TextButton(onClick = onClick, contentPadding = PaddingValues(0.dp)) {
            Text(action, color = ImiBlue, fontSize = 11.sp)
        }
    }
}

@Composable
private fun FeatureTile(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, modifier: Modifier, onClick: () -> Unit) {
    Surface(color = ImiSurface, shape = RoundedCornerShape(18.dp), modifier = modifier.clickable { onClick() }) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(tint.copy(alpha = .18f)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = tint, modifier = Modifier.size(21.dp))
            }
            Text(title, color = ImiText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(subtitle, color = ImiMuted, fontSize = 11.sp, maxLines = 1)
        }
    }
}

private data class DemoChat(val name: String, val message: String, val time: String, val unread: Int, val color: Color)
private val demoChats = listOf(
    DemoChat("أحمد", "هل أنت متاح اليوم؟", "10:42", 2, Color(0xFF3D6BFF)),
    DemoChat("سارة", "أرسلت لك الصورة 😊", "09:18", 0, Color(0xFFE27B9B)),
    DemoChat("مجموعة الأصدقاء", "يوسف: نلتقي مساءً", "أمس", 4, Color(0xFF3AAE9B)),
    DemoChat("مريم", "شكراً جزيلاً!", "أمس", 0, Color(0xFFE1A34B))
)

@Composable
private fun ChatMessageBubble(message: String) {
    val context = LocalContext.current
    val imageUri = message.takeIf { it.startsWith("@image:") }?.removePrefix("@image:")
    val audioPath = message.takeIf { it.startsWith("@audio:") }?.removePrefix("@audio:")
    val bitmap = remember(imageUri) {
        imageUri?.let { savedUri ->
            runCatching {
                context.contentResolver.openInputStream(android.net.Uri.parse(savedUri))?.use { stream ->
                    android.graphics.BitmapFactory.decodeStream(stream)
                }
            }.getOrNull()
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
        Surface(color = ImiBlue.copy(alpha = .2f), shape = RoundedCornerShape(16.dp)) {
            when {
                imageUri != null && bitmap != null -> Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "صورة مرفقة برسالة",
                    modifier = Modifier.widthIn(max = 240.dp).heightIn(max = 260.dp).clip(RoundedCornerShape(12.dp))
                )
                imageUri != null -> Text("تعذّر فتح الصورة المرفقة", color = ImiMuted, modifier = Modifier.padding(12.dp))
                audioPath != null -> AudioMessagePlayer(audioPath)
                else -> Text(message, color = ImiText, modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp))
            }
        }
    }
}

@Composable
private fun AudioMessagePlayer(path: String) {
    var playing by remember(path) { mutableStateOf(false) }
    val context = LocalContext.current
    val player = remember(path) { android.media.MediaPlayer() }
    DisposableEffect(player) {
        player.setOnCompletionListener { playing = false }
        onDispose { runCatching { player.release() } }
    }
    Row(
        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        IconButton(onClick = {
            if (playing) {
                runCatching { player.pause() }
                playing = false
            } else {
                runCatching {
                    player.reset()
                    player.setDataSource(path)
                    player.prepare()
                    player.start()
                    playing = true
                }.onFailure { playing = false }
            }
        }) {
            Icon(if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (playing) "إيقاف مؤقت" else "تشغيل الرسالة الصوتية", tint = ImiBlue)
        }
        Text(if (playing) "تشغيل الرسالة الصوتية…" else "رسالة صوتية", color = ImiText, fontSize = 13.sp)
    }
}

@Composable
private fun ChatsScreen() {
    var query by remember { mutableStateOf("") }
    var opened by remember { mutableStateOf<String?>(null) }
    var draft by remember { mutableStateOf("") }
    var showNewChat by remember { mutableStateOf(false) }
    var showDeleteChat by remember { mutableStateOf(false) }
    var newChatName by remember { mutableStateOf("") }
    var isRecording by remember { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<android.media.MediaRecorder?>(null) }
    var recordingPath by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val audioPermission = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            runCatching {
                val folder = java.io.File(context.filesDir, "voice_messages").apply { mkdirs() }
                val file = java.io.File(folder, "voice_${System.currentTimeMillis()}.m4a")
                val activeRecorder = android.media.MediaRecorder()
                activeRecorder.setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
                activeRecorder.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4)
                activeRecorder.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC)
                activeRecorder.setAudioEncodingBitRate(96000)
                activeRecorder.setAudioSamplingRate(44100)
                activeRecorder.setOutputFile(file.absolutePath)
                activeRecorder.prepare()
                activeRecorder.start()
                recorder = activeRecorder
                recordingPath = file.absolutePath
                isRecording = true
            }.onFailure {
                runCatching { recorder?.release() }
                recorder = null
                isRecording = false
            }
        }
    }
    val chatPrefs = remember(context) {
        context.getSharedPreferences("imi_local_chat", android.content.Context.MODE_PRIVATE)
    }
    var localChatNames by remember(chatPrefs) {
        mutableStateOf(
            runCatching {
                val stored = chatPrefs.getString("chat_names", null)
                if (stored.isNullOrBlank()) emptyList()
                else {
                    val array = JSONArray(stored)
                    List(array.length()) { index -> array.getString(index) }
                }
            }.getOrDefault(emptyList())
        )
    }
    val sentMessages = remember(context) {
        val restored = mutableStateMapOf<String, List<String>>()
        val raw = context.getSharedPreferences("imi_local_chat", android.content.Context.MODE_PRIVATE)
            .getString("messages", null)
        if (!raw.isNullOrBlank()) {
            runCatching {
                val root = JSONObject(raw)
                root.keys().forEach { chatName ->
                    val values = root.getJSONArray(chatName)
                    restored[chatName] = List(values.length()) { index -> values.getString(index) }
                }
            }
        }
        restored
    }
    val imageMessagePicker = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            val chatName = opened
            if (chatName != null) {
                val updated = sentMessages[chatName].orEmpty() + "@image:${uri}"
                sentMessages[chatName] = updated
                val root = JSONObject()
                sentMessages.forEach { (name, messages) -> root.put(name, JSONArray(messages)) }
                chatPrefs.edit().putString("messages", root.toString()).apply()
            }
        }
    }
    val localChats = localChatNames.map { name ->
        DemoChat(name, sentMessages[name]?.lastOrNull()?.let { if (it.startsWith("@image:")) "صورة" else if (it.startsWith("@audio:")) "رسالة صوتية" else it } ?: "ابدأ محادثة جديدة", "الآن", 0, ImiBlue)
    }
    val filtered = (demoChats + localChats).distinctBy { it.name }.filter { it.name.contains(query, true) }
    if (opened != null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconAction(Icons.Filled.ArrowForward, "رجوع") { opened = null }
                Spacer(Modifier.width(12.dp))
                Text(opened!!, color = ImiText, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
                IconAction(Icons.Filled.DeleteOutline, "حذف المحادثة") { showDeleteChat = true }
            }
            Spacer(Modifier.height(20.dp))
            Text("رسائلك محفوظة على هذا الجهاز فقط، وليست مرسلة عبر الإنترنت.", color = ImiMuted, fontSize = 12.sp)
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sentMessages[opened].orEmpty()) { message ->
                    ChatMessageBubble(message)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = {
                        if (isRecording) {
                            val activeRecorder = recorder
                            val savedPath = recordingPath
                            runCatching { activeRecorder?.stop() }
                            runCatching { activeRecorder?.release() }
                            recorder = null
                            recordingPath = null
                            isRecording = false
                            val chatName = opened
                            if (savedPath != null && chatName != null && java.io.File(savedPath).length() > 0L) {
                                val updated = sentMessages[chatName].orEmpty() + "@audio:$savedPath"
                                sentMessages[chatName] = updated
                                val root = JSONObject()
                                sentMessages.forEach { (name, messages) -> root.put(name, JSONArray(messages)) }
                                chatPrefs.edit().putString("messages", root.toString()).apply()
                            }
                        } else if (androidx.core.content.ContextCompat.checkSelfPermission(
                                context, android.Manifest.permission.RECORD_AUDIO
                            ) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            audioPermission.launch(android.Manifest.permission.RECORD_AUDIO)
                        } else {
                            audioPermission.launch(android.Manifest.permission.RECORD_AUDIO)
                        }
                    }
                ) {
                    Icon(
                        if (isRecording) Icons.Filled.Stop else Icons.Filled.Mic,
                        if (isRecording) "إيقاف التسجيل وإرسال" else "تسجيل رسالة صوتية",
                        tint = if (isRecording) Color(0xFFFF6685) else ImiMuted
                    )
                }
                IconButton(onClick = { imageMessagePicker.launch(arrayOf("image/*")) }) {
                    Icon(Icons.Filled.Image, "إرفاق صورة", tint = ImiMuted)
                }
                OutlinedTextField(value = draft, onValueChange = { draft = it }, modifier = Modifier.weight(1f), placeholder = { Text(if (isRecording) "جارٍ تسجيل الصوت…" else "اكتب رسالة…") }, singleLine = true, enabled = !isRecording)
                IconButton(
                    onClick = {
                        val text = draft.trim()
                        val chatName = opened
                        if (text.isNotEmpty() && chatName != null) {
                            val updated = sentMessages[chatName].orEmpty() + text
                            sentMessages[chatName] = updated
                            val root = JSONObject()
                            sentMessages.forEach { (name, messages) ->
                                root.put(name, JSONArray(messages))
                            }
                            context.getSharedPreferences("imi_local_chat", android.content.Context.MODE_PRIVATE)
                                .edit().putString("messages", root.toString()).apply()
                            draft = ""
                        }
                    },
                    enabled = draft.isNotBlank()
                ) { Icon(Icons.Filled.Send, null, tint = ImiBlue) }
            }
        }
        if (showDeleteChat) {
            AlertDialog(
                onDismissRequest = { showDeleteChat = false },
                title = { Text("حذف المحادثة من هذا الجهاز؟") },
                text = { Text("سيتم حذف الرسائل المحفوظة محلياً لهذه المحادثة. لا يؤثر ذلك على أي حساب أو جهاز آخر.", color = ImiMuted) },
                confirmButton = {
                    TextButton(onClick = {
                        val chatName = opened
                        if (chatName != null) {
                            sentMessages.remove(chatName)
                            val root = JSONObject()
                            sentMessages.forEach { (name, messages) -> root.put(name, JSONArray(messages)) }
                            chatPrefs.edit().putString("messages", root.toString()).apply()
                            if (chatName in localChatNames) {
                                localChatNames = localChatNames.filterNot { it == chatName }
                                val names = JSONArray()
                                localChatNames.forEach { names.put(it) }
                                chatPrefs.edit().putString("chat_names", names.toString()).apply()
                            }
                            opened = null
                        }
                        showDeleteChat = false
                    }) { Text("حذف", color = Color(0xFFFF6685)) }
                },
                dismissButton = {
                    TextButton(onClick = { showDeleteChat = false }) { Text("إلغاء") }
                }
            )
        }
        return
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 22.dp)) {
        PageHeader("المحادثات", "ابقَ على تواصل") {
            IconAction(Icons.Filled.Edit, "محادثة جديدة") { showNewChat = true }
        }
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("ابحث عن محادثة…") }, leadingIcon = { Icon(Icons.Filled.Search, null, tint = ImiMuted) }, shape = RoundedCornerShape(16.dp))
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            items(filtered) { chat ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { opened = chat.name }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(50.dp).clip(CircleShape).background(chat.color.copy(alpha = .22f)), contentAlignment = Alignment.Center) {
                        Text(chat.name.take(1), color = ImiText, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(chat.name, color = ImiText, fontWeight = FontWeight.SemiBold)
                        Text(chat.message, color = ImiMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(chat.time, color = ImiMuted, fontSize = 10.sp)
                        if (chat.unread > 0) Box(Modifier.clip(CircleShape).background(ImiBlue).padding(horizontal = 7.dp, vertical = 3.dp)) { Text(chat.unread.toString(), color = Color.White, fontSize = 10.sp) }
                    }
                }
            }
        }
        Text("المحادثات المعروضة تجريبية؛ المحادثات التي تنشئها ورسائلك تُحفظ محلياً على الجهاز فقط.", color = ImiMuted, fontSize = 11.sp)
    }
    if (showNewChat) {
        AlertDialog(
            onDismissRequest = { showNewChat = false; newChatName = "" },
            title = { Text("محادثة جديدة") },
            text = {
                OutlinedTextField(
                    value = newChatName,
                    onValueChange = { newChatName = it },
                    label = { Text("اسم الشخص أو المجموعة") },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = newChatName.trim()
                        if (name.isNotEmpty()) {
                            if (name !in demoChats.map { it.name } && name !in localChatNames) {
                                localChatNames = localChatNames + name
                                val names = JSONArray()
                                localChatNames.forEach { names.put(it) }
                                chatPrefs.edit().putString("chat_names", names.toString()).apply()
                            }
                            opened = name
                            showNewChat = false
                            newChatName = ""
                        }
                    },
                    enabled = newChatName.isNotBlank()
                ) { Text("إنشاء") }
            },
            dismissButton = {
                TextButton(onClick = { showNewChat = false; newChatName = "" }) { Text("إلغاء") }
            }
        )
    }
}

@Composable
private fun ReelsScreen() {
    val context = LocalContext.current
    val prefs = remember(context) {
        context.getSharedPreferences("imi_local_reels", android.content.Context.MODE_PRIVATE)
    }
    var videoUris by remember(prefs) {
        mutableStateOf(
            runCatching {
                val array = JSONArray(prefs.getString("videos", "[]"))
                List(array.length()) { array.getString(it) }
            }.getOrDefault(emptyList())
        )
    }
    var selectedUri by remember { mutableStateOf(videoUris.firstOrNull()) }
    val picker = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            val value = uri.toString()
            if (value !in videoUris) {
                videoUris = listOf(value) + videoUris
                val saved = JSONArray()
                videoUris.forEach { saved.put(it) }
                prefs.edit().putString("videos", saved.toString()).apply()
            }
            selectedUri = value
        }
    }
    val player = remember(selectedUri) {
        selectedUri?.let {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(android.net.Uri.parse(it)))
                prepare()
                playWhenReady = false
            }
        }
    }
    DisposableEffect(player) {
        onDispose { player?.release() }
    }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        PageHeader("Reels", "مقاطع الفيديو على هذا الجهاز") {
            IconAction(Icons.Filled.Add, "إضافة فيديو") {
                picker.launch(arrayOf("video/*"))
            }
        }
        if (selectedUri != null && player != null) {
            Surface(color = Color.Black, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth().weight(1f)) {
                AndroidView(
                    factory = { viewContext ->
                        PlayerView(viewContext).apply {
                            this.player = player
                            useController = true
                        }
                    },
                    update = { it.player = player },
                    modifier = Modifier.fillMaxSize()
                )
            }
        } else {
            Surface(
                color = ImiSurface,
                shape = RoundedCornerShape(22.dp),
                modifier = Modifier.fillMaxWidth().weight(1f)
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(Icons.Filled.VideoLibrary, null, tint = ImiBlue, modifier = Modifier.size(58.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("مكتبة مقاطع IMI", color = ImiText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "أضف فيديو من هاتفك لتشغيله داخل التطبيق. هذه المقاطع محلية ولا تُرفع إلى الإنترنت.",
                        color = ImiMuted,
                        fontSize = 12.sp,
                        lineHeight = 19.sp
                    )
                    Spacer(Modifier.height(14.dp))
                    Button(onClick = { picker.launch(arrayOf("video/*")) }) {
                        Icon(Icons.Filled.Add, null)
                        Spacer(Modifier.width(6.dp))
                        Text("اختيار فيديو")
                    }
                }
            }
        }
        if (videoUris.isNotEmpty()) {
            Text("مقاطعك المحفوظة (${videoUris.size})", color = ImiText, fontWeight = FontWeight.SemiBold)
            LazyColumn(
                modifier = Modifier.heightIn(max = 190.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(videoUris) { uri ->
                    val isSelected = uri == selectedUri
                    Surface(
                        color = if (isSelected) ImiBlue.copy(alpha = .16f) else ImiSurface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().clickable { selectedUri = uri }
                    ) {
                        Row(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.PlayCircle, null, tint = if (isSelected) ImiBlue else ImiMuted)
                            Spacer(Modifier.width(9.dp))
                            Text(
                                android.net.Uri.parse(uri).lastPathSegment ?: "مقطع فيديو",
                                color = ImiText,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = {
                                videoUris = videoUris.filterNot { it == uri }
                                val saved = JSONArray()
                                videoUris.forEach { saved.put(it) }
                                prefs.edit().putString("videos", saved.toString()).apply()
                                if (selectedUri == uri) selectedUri = videoUris.firstOrNull()
                            }) {
                                Icon(Icons.Filled.DeleteOutline, "حذف من القائمة", tint = Color(0xFFFF6685))
                            }
                        }
                    }
                }
            }
        }
        Text(
            "المشغل والقائمة يعملان محلياً فقط؛ لا يوجد نشر Reels أو موجز مشترك أو رفع سحابي في هذه النسخة.",
            color = ImiMuted,
            fontSize = 10.sp
        )
    }
}

@Composable
private fun AcademyScreen() {
    val context = LocalContext.current
    val progressPrefs = remember(context) {
        context.getSharedPreferences("imi_academy_progress", android.content.Context.MODE_PRIVATE)
    }
    val courses = listOf(
        Triple("التعلّم الذاتي", "خطوات عملية لبناء عادة تعلّم مستمرة", "حدّد هدفاً صغيراً وواضحاً، وقسّمه إلى جلسات قصيرة. خصّص وقتاً ثابتاً للتعلّم، واكتب في نهاية كل جلسة ما فهمته وما يحتاج إلى مراجعة. الاستمرارية أهم من طول الجلسة."),
        Triple("اللغة الإنجليزية", "ابدأ بالمفردات والجمل اليومية", "تعلّم خمس كلمات جديدة يومياً ضمن جمل مفيدة. استمع إلى نطقها، ثم كوّن جملتين من عندك. راجع الكلمات بعد يوم ثم بعد أسبوع لتثبيتها في الذاكرة."),
        Triple("أساسيات البرمجة", "افهم المتغيرات والشروط والحلقات", "المتغير يخزّن قيمة يمكن استعمالها لاحقاً. الشرط يختار مسار التنفيذ حسب نتيجة اختبار، والحلقة تكرّر مجموعة تعليمات. ابدأ بأمثلة صغيرة وجرّب تغيير القيم ولاحظ النتيجة.")
    )
    var completed by remember(progressPrefs) {
        mutableStateOf(
            runCatching {
                val array = JSONArray(progressPrefs.getString("completed", "[]"))
                List(array.length()) { array.getString(it) }.toSet()
            }.getOrDefault(emptySet())
        )
    }
    var selectedCourse by remember { mutableStateOf<Int?>(null) }
    Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PageHeader("IMI Academy", "تعلّم مهارات جديدة")
        Surface(color = ImiSurface, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Filled.School, null, tint = ImiPurple, modifier = Modifier.size(34.dp))
                Text("بوابتك إلى المعرفة", color = ImiText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("دروس قصيرة يمكنك قراءتها دون اتصال. تقدّمك يُحفظ على هذا الجهاز.", color = ImiMuted, fontSize = 13.sp, lineHeight = 20.sp)
                Text("${completed.size} من ${courses.size} دروس مكتملة", color = ImiBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                LinearProgressIndicator(
                    progress = { completed.size.toFloat() / courses.size.toFloat() },
                    modifier = Modifier.fillMaxWidth(),
                    color = ImiBlue,
                    trackColor = ImiSurface2
                )
            }
        }
        courses.forEachIndexed { index, course ->
            val isDone = index.toString() in completed
            Surface(
                color = ImiSurface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().clickable { selectedCourse = index }
            ) {
                Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).clip(RoundedCornerShape(12.dp)).background(ImiPurple.copy(alpha = .16f)), contentAlignment = Alignment.Center) {
                        if (isDone) Icon(Icons.Filled.CheckCircle, null, tint = ImiGreen)
                        else Text("${index + 1}", color = Color(0xFFB69BFF), fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(course.first, color = ImiText, fontWeight = FontWeight.SemiBold)
                        Text(course.second, color = ImiMuted, fontSize = 11.sp)
                    }
                    Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                }
            }
        }
        Text("هذه دروس تأسيسية محلية وليست محتوى منشوراً من خادم أو مدرسين.", color = ImiMuted, fontSize = 11.sp)
    }
    selectedCourse?.let { index ->
        val course = courses[index]
        val isDone = index.toString() in completed
        AlertDialog(
            onDismissRequest = { selectedCourse = null },
            title = { Text(course.first) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(course.second, color = ImiBlue, fontWeight = FontWeight.SemiBold)
                    Text(course.third, color = ImiMuted, lineHeight = 21.sp)
                    if (isDone) Text("تم إكمال هذا الدرس", color = ImiGreen, fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    completed = if (isDone) completed - index.toString() else completed + index.toString()
                    val saved = JSONArray()
                    completed.forEach { saved.put(it) }
                    progressPrefs.edit().putString("completed", saved.toString()).apply()
                    selectedCourse = null
                }) { Text(if (isDone) "إلغاء الإكمال" else "تحديد كمكتمل") }
            },
            dismissButton = {
                TextButton(onClick = { selectedCourse = null }) { Text("إغلاق") }
            }
        )
    }
}

@Composable
private fun ProfileScreen() {
    val context = LocalContext.current
    val profilePrefs = remember(context) {
        context.getSharedPreferences("imi_local_profile", android.content.Context.MODE_PRIVATE)
    }
    var displayName by remember(profilePrefs) {
        mutableStateOf(profilePrefs.getString("display_name", "مستخدم IMI") ?: "مستخدم IMI")
    }
    var city by remember(profilePrefs) {
        mutableStateOf(profilePrefs.getString("city", "المغرب") ?: "المغرب")
    }
    var editing by remember { mutableStateOf(false) }
    var profileSection by remember { mutableStateOf<String?>(null) }
    val localUserId = remember(profilePrefs) {
        val existing = profilePrefs.getString("local_user_id", null)
        if (existing != null) existing
        else java.util.UUID.randomUUID().toString().replace("-", "").take(16).uppercase().also {
            profilePrefs.edit().putString("local_user_id", it).apply()
        }
    }
    var avatarUri by remember(profilePrefs) {
        mutableStateOf(profilePrefs.getString("avatar_uri", null))
    }
    val imagePicker = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            avatarUri = uri.toString()
            profilePrefs.edit().putString("avatar_uri", avatarUri).apply()
        }
    }
    val avatarBitmap = remember(avatarUri) {
        avatarUri?.let { savedUri ->
            runCatching {
                context.contentResolver.openInputStream(android.net.Uri.parse(savedUri))?.use { stream ->
                    android.graphics.BitmapFactory.decodeStream(stream)
                }
            }.getOrNull()
        }
    }
    Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PageHeader("حسابي", "ملفك الشخصي") {
            IconAction(Icons.Filled.Settings, "الإعدادات") { profileSection = "الإعدادات" }
        }
        Surface(color = ImiSurface, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Box(Modifier.size(86.dp).clip(CircleShape).background(ImiBlue.copy(alpha = .2f)), contentAlignment = Alignment.Center) {
                    if (avatarBitmap != null) {
                        Image(
                            bitmap = avatarBitmap.asImageBitmap(),
                            contentDescription = "الصورة الشخصية",
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Icon(Icons.Filled.Person, null, tint = ImiBlue, modifier = Modifier.size(48.dp))
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(onClick = { imagePicker.launch(arrayOf("image/*")) }) {
                        Icon(Icons.Filled.CameraAlt, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (avatarBitmap == null) "اختيار صورة شخصية" else "تغيير الصورة")
                    }
                    if (avatarUri != null) {
                        TextButton(onClick = {
                            avatarUri = null
                            profilePrefs.edit().remove("avatar_uri").apply()
                        }) { Text("إزالة", color = Color(0xFFFF6685)) }
                    }
                }
                Text(displayName, color = ImiText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(city, color = ImiMuted, fontSize = 12.sp)
                Surface(color = ImiSurface2, shape = RoundedCornerShape(10.dp)) {
                    Row(
                        Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("معرّفك المحلي", color = ImiMuted, fontSize = 10.sp)
                        Spacer(Modifier.width(8.dp))
                        Text(localUserId, color = ImiBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.width(8.dp))
                        IconButton(
                            onClick = {
                                val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("IMI ID", localUserId))
                            },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(Icons.Filled.ContentCopy, "نسخ المعرّف", tint = ImiMuted, modifier = Modifier.size(15.dp))
                        }
                    }
                }
                OutlinedButton(onClick = { editing = !editing }) {
                    Icon(Icons.Filled.Edit, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(if (editing) "إغلاق التعديل" else "تعديل الملف")
                }
                if (editing) {
                    OutlinedTextField(value = displayName, onValueChange = {
                        displayName = it
                        profilePrefs.edit().putString("display_name", it).apply()
                    }, label = { Text("الاسم") }, singleLine = true)
                    OutlinedTextField(value = city, onValueChange = {
                        city = it
                        profilePrefs.edit().putString("city", it).apply()
                    }, label = { Text("المدينة") }, singleLine = true)
                }
            }
        }
        listOf("الأصدقاء", "الخصوصية والأمان", "الإعدادات").forEach { label ->
            Surface(color = ImiSurface, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth().clickable { profileSection = label }) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(label, color = ImiText, modifier = Modifier.weight(1f))
                    Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                }
            }
        }
        Text("المعرّف والاسم والمدينة محفوظة محلياً على هذا الجهاز فقط. هذا ليس حساباً سحابياً، ولا يتيح العثور على مستخدمين أو المزامنة بين الأجهزة.", color = ImiMuted, fontSize = 11.sp)
    }
    when (profileSection) {
        "الأصدقاء" -> AlertDialog(
            onDismissRequest = { profileSection = null },
            title = { Text("الأصدقاء") },
            text = { Text("قائمة الأصدقاء والبحث عن مستخدمين تحتاج إلى ربط حسابات IMI وخدمة الخادم. لم تتم إضافة أشخاص وهميين.", color = ImiMuted) },
            confirmButton = { TextButton(onClick = { profileSection = null }) { Text("حسناً") } }
        )
        "الخصوصية والأمان" -> AlertDialog(
            onDismissRequest = { profileSection = null },
            title = { Text("الخصوصية والأمان") },
            text = { Text("إعدادات الخصوصية الفعلية ستُتاح بعد تفعيل الحساب والمزامنة. حالياً تُحفظ بيانات الملف محلياً على هذا الجهاز فقط.", color = ImiMuted) },
            confirmButton = { TextButton(onClick = { profileSection = null }) { Text("حسناً") } }
        )
        "الإعدادات" -> AlertDialog(
            onDismissRequest = { profileSection = null },
            title = { Text("إعدادات IMI") },
            text = { Text("إصدار الواجهة الأولية. لا يوجد تسجيل دخول أو مزامنة سحابية مفعّلة في هذه النسخة.", color = ImiMuted) },
            confirmButton = { TextButton(onClick = { profileSection = null }) { Text("إغلاق") } }
        )
    }
}
