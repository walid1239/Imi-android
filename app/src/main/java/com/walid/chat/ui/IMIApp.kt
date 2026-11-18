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
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import android.app.DownloadManager
import android.os.Environment
import android.widget.Toast

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
fun IMIApp(cloudSessionMessage: String? = null) {
    var selected by remember { mutableStateOf(ImiTab.Home) }
    IMITheme {
        Scaffold(
            containerColor = ImiBackground,
            bottomBar = { ImiBottomBar(selected) { selected = it } }
        ) { padding ->
            Column(Modifier.fillMaxSize().background(ImiBackground).padding(padding)) {
                if (cloudSessionMessage != null) {
                    Text(
                        cloudSessionMessage,
                        color = if (cloudSessionMessage.startsWith("متصل")) ImiGreen else ImiMuted,
                        fontSize = 10.sp,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
                    )
                }
                Box(Modifier.weight(1f).fillMaxWidth()) {
                when (selected) {
                    ImiTab.Home -> HomeScreen(
                        onChats = { selected = ImiTab.Chats },
                        onReels = { selected = ImiTab.Reels },
                        onAcademy = { selected = ImiTab.Academy }
                    )
                    ImiTab.Chats -> FirebaseChatsScreen()
                    ImiTab.Reels -> ReelsScreen()
                    ImiTab.Academy -> AcademyScreen()
                    ImiTab.Profile -> ProfileScreen()
                }
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
        item { RecentChatsSection(onChats) }
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
        item { Text("المحادثات والملفات العامة تعتمد على إعداد Firebase؛ ميزات الوسائط والمكالمات والتحقق عبر WhatsApp لم تُفعّل بعد.", color = ImiMuted, fontSize = 11.sp) }
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
private fun RecentChatsSection(onChats: () -> Unit) {
    val context = LocalContext.current
    var recent by remember { mutableStateOf<List<com.walid.chat.data.model.Chat>>(emptyList()) }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        loaded = true
        runCatching {
            if (com.google.firebase.FirebaseApp.getApps(context.applicationContext).isNotEmpty()) {
                com.walid.chat.data.repository.FirebaseChatRepositoryFactory.create(context).getChats().getOrThrow().take(3)
            } else emptyList()
        }.onSuccess { recent = it }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeader("أحدث المحادثات", "كل المحادثات", onChats)
        if (recent.isEmpty()) {
            Surface(color = ImiSurface, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().clickable { onChats() }) {
                Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.ChatBubbleOutline, null, tint = ImiBlue)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(if (loaded) "لا توجد محادثات بعد" else "جارٍ تحميل المحادثات…", color = ImiText, fontSize = 13.sp)
                        Text("ابدأ محادثة جديدة وستظهر هنا", color = ImiMuted, fontSize = 11.sp)
                    }
                    Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                }
            }
        } else {
            recent.forEach { chat ->
                Surface(color = ImiSurface, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth().clickable { onChats() }) {
                    Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(ImiBlue.copy(alpha = .18f)), contentAlignment = Alignment.Center) {
                            Text(chat.title.take(1), color = ImiText, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(chat.title, color = ImiText, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text(chat.lastMessage.ifBlank { "ابدأ المحادثة" }, color = ImiMuted, fontSize = 11.sp, maxLines = 1)
                        }
                        Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                    }
                }
            }
        }
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
    val scope = rememberCoroutineScope()
    var statusText by remember { mutableStateOf<String?>(null) }
    var statusMediaPath by remember { mutableStateOf<String?>(null) }
    var statusDocumentId by remember { mutableStateOf<String?>(null) }
    var expiresAt by remember { mutableStateOf<Long?>(null) }
    var showComposer by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    var draftImageUri by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val configured = remember(context) {
        com.google.firebase.FirebaseApp.getApps(context.applicationContext).isNotEmpty()
            && com.google.firebase.auth.FirebaseAuth.getInstance().currentUser != null
    }
    val auth = remember(configured) {
        if (configured) com.google.firebase.auth.FirebaseAuth.getInstance() else null
    }
    val db = remember(configured) {
        if (configured) com.google.firebase.firestore.FirebaseFirestore.getInstance() else null
    }
    val storage = remember(configured) {
        if (configured) com.google.firebase.storage.FirebaseStorage.getInstance() else null
    }
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

    LaunchedEffect(configured, auth?.currentUser?.uid) {
        val uid = auth?.currentUser?.uid ?: return@LaunchedEffect
        runCatching {
            db!!.collection("users").document(uid).collection("statuses")
                .whereGreaterThan("expiresAt", com.google.firebase.Timestamp.now())
                .orderBy("expiresAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(1).get().await().documents.firstOrNull()
        }.onSuccess { doc ->
            statusDocumentId = doc?.id
            statusText = doc?.getString("text")
            statusMediaPath = doc?.getString("mediaPath")
            expiresAt = doc?.getTimestamp("expiresAt")?.toDate()?.time
        }.onFailure {
            message = it.localizedMessage ?: "تعذر تحميل حالتك السحابية"
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("الحالات", if (statusText == null && statusMediaPath == null) "أضف حالتك" else "حالتي", { showComposer = true })
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(58.dp).clickable { showComposer = true }
            ) {
                Box(Modifier.size(54.dp).clip(CircleShape).background(ImiSurface2), contentAlignment = Alignment.Center) {
                    if (statusText == null && statusMediaPath == null) Icon(Icons.Filled.Add, null, tint = ImiBlue, modifier = Modifier.size(25.dp))
                    else Icon(Icons.Filled.Person, null, tint = ImiBlue, modifier = Modifier.size(25.dp))
                }
                Spacer(Modifier.height(5.dp))
                Text(if (statusText == null && statusMediaPath == null) "أضف حالة" else "حالتي", color = ImiMuted, fontSize = 10.sp, maxLines = 1)
            }
            Surface(color = ImiSurface, shape = RoundedCornerShape(16.dp), modifier = Modifier.weight(1f)) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("حالات الأصدقاء", color = ImiText, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text("ستظهر حالات الأصدقاء بعد إنشاء علاقات صداقة موثقة وربطها بالخادم.", color = ImiMuted, fontSize = 10.sp, lineHeight = 15.sp)
                }
            }
        }
        if (statusText != null || statusMediaPath != null) {
            statusText?.let { Text(it, color = ImiMuted, fontSize = 12.sp, maxLines = 3) }
            if (statusMediaPath != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Image, null, tint = ImiBlue, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("صورة محفوظة في سحابة IMI", color = ImiMuted, fontSize = 11.sp)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("تنتهي الحالة تلقائياً بعد 28 ساعة من نشرها.", color = ImiMuted, fontSize = 10.sp, modifier = Modifier.weight(1f))
                TextButton(enabled = !loading, onClick = {
                    val uid = auth?.currentUser?.uid
                    val path = statusMediaPath
                    if (uid == null || db == null) {
                        message = "يلزم تفعيل Firebase قبل حذف الحالة السحابية."
                    } else {
                        loading = true
                        scope.launch {
                            runCatching {
                                val documentId = statusDocumentId ?: error("لم يتم العثور على معرّف الحالة")
                                db.collection("users").document(uid).collection("statuses")
                                    .document(documentId).delete().await()
                                if (path != null) runCatching { storage?.reference?.child(path)?.delete()?.await() }
                            }.onSuccess {
                                statusText = null
                                statusMediaPath = null
                                statusDocumentId = null
                                expiresAt = null
                                message = "حُذفت حالتك من السحابة."
                            }.onFailure {
                                message = it.localizedMessage ?: "تعذر حذف الحالة"
                            }
                            loading = false
                        }
                    }
                }, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp)) {
                    Text("حذف الحالة", color = Color(0xFFFF6685), fontSize = 11.sp)
                }
            }
        }
        message?.let { Text(it, color = ImiMuted, fontSize = 10.sp) }
    }
    if (showComposer) {
        AlertDialog(
            onDismissRequest = { if (!loading) showComposer = false },
            title = { Text("إضافة حالة") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = draft, onValueChange = { draft = it }, label = { Text("ماذا تريد أن تشارك؟") }, maxLines = 4)
                    OutlinedButton(onClick = { statusImagePicker.launch(arrayOf("image/*")) }) {
                        Icon(Icons.Filled.Image, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (draftImageUri == null) "إرفاق صورة" else "تغيير الصورة")
                    }
                    if (draftImageUri != null) {
                        Text("تم اختيار صورة للنشر السحابي.", color = ImiMuted, fontSize = 11.sp)
                        TextButton(onClick = { draftImageUri = null }) { Text("إزالة الصورة") }
                    }
                    Text("تُحفظ الحالة في السحابة وتُحذف صلاحية عرضها بعد 28 ساعة.", color = ImiMuted, fontSize = 10.sp)
                }
            },
            confirmButton = {
                TextButton(enabled = !loading && (draft.isNotBlank() || draftImageUri != null), onClick = {
                    val uid = auth?.currentUser?.uid
                    if (uid == null || db == null || storage == null) {
                        message = "Firebase غير مهيأ؛ لم تُنشر الحالة. لن نحفظها كحالة محلية."
                        showComposer = false
                    } else {
                        loading = true
                        scope.launch {
                            runCatching {
                                val id = java.util.UUID.randomUUID().toString()
                                val expiry = com.google.firebase.Timestamp(
                                    java.util.Date(System.currentTimeMillis() + 28L * 60L * 60L * 1000L)
                                )
                                val data = mutableMapOf<String, Any>(
                                    "ownerUid" to uid,
                                    "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                                    "expiresAt" to expiry
                                )
                                val value = draft.trim().take(700)
                                if (value.isNotEmpty()) data["text"] = value
                                draftImageUri?.let { selectedUri ->
                                    val uri = android.net.Uri.parse(selectedUri)
                                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                                    require(mime in setOf("image/jpeg", "image/png", "image/webp")) { "صيغة الصورة غير مدعومة." }
                                    val ext = when (mime) { "image/png" -> "png"; "image/webp" -> "webp"; else -> "jpg" }
                                    val path = "users/$uid/statuses/$id/status.$ext"
                                    storage.reference.child(path).putFile(
                                        uri,
                                        com.google.firebase.storage.StorageMetadata.Builder().setContentType(mime).build()
                                    ).await()
                                    data["mediaPath"] = path
                                }
                                db.collection("users").document(uid).collection("statuses").document(id).set(data).await()
                                data
                            }.onSuccess { data ->
                                statusDocumentId = id
                                statusText = data["text"] as? String
                                statusMediaPath = data["mediaPath"] as? String
                                expiresAt = (data["expiresAt"] as? com.google.firebase.Timestamp)?.toDate()?.time
                                draft = ""
                                draftImageUri = null
                                showComposer = false
                                message = "نُشرت حالتك في سحابة IMI."
                            }.onFailure {
                                message = it.localizedMessage ?: "تعذر نشر الحالة السحابية"
                            }
                            loading = false
                        }
                    }
                }) { Text(if (loading) "جارٍ النشر…" else "نشر") }
            },
            dismissButton = { TextButton(enabled = !loading, onClick = { showComposer = false }) { Text("إلغاء") } }
        )
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
private val demoChats = emptyList<DemoChat>()

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
    var messageQuery by remember { mutableStateOf("") }
    var showNewChat by remember { mutableStateOf(false) }
    var showDeleteChat by remember { mutableStateOf(false) }
    var newChatName by remember { mutableStateOf("") }
    var isRecording by remember { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<android.media.MediaRecorder?>(null) }
    var recordingPath by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    DisposableEffect(Unit) {
        onDispose {
            runCatching { recorder?.stop() }
            runCatching { recorder?.release() }
            recorder = null
            isRecording = false
        }
    }
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
    val activeMessages = sentMessages[opened].orEmpty()
    val filteredMessages = activeMessages.filter { message ->
        messageQuery.isBlank() || message.contains(messageQuery.trim(), ignoreCase = true)
    }
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
            OutlinedTextField(
                value = messageQuery,
                onValueChange = { messageQuery = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("ابحث داخل هذه المحادثة…") },
                leadingIcon = { Icon(Icons.Filled.Search, null, tint = ImiMuted) },
                trailingIcon = {
                    if (messageQuery.isNotEmpty()) {
                        IconButton(onClick = { messageQuery = "" }) {
                            Icon(Icons.Filled.Close, "مسح البحث", tint = ImiMuted)
                        }
                    }
                },
                shape = RoundedCornerShape(14.dp)
            )
            if (messageQuery.isNotBlank()) {
                Text("${filteredMessages.size} من ${activeMessages.size} رسالة", color = ImiMuted, fontSize = 10.sp)
            }
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredMessages) { message ->
                    ChatMessageBubble(message)
                }
                if (filteredMessages.isEmpty()) {
                    item {
                        Text(
                            if (activeMessages.isEmpty()) "لا توجد رسائل بعد." else "لا توجد رسائل تطابق البحث.",
                            color = ImiMuted,
                            modifier = Modifier.fillMaxWidth().padding(20.dp)
                        )
                    }
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
                if (isRecording) {
                    IconButton(onClick = {
                        val activeRecorder = recorder
                        val discardPath = recordingPath
                        runCatching { activeRecorder?.stop() }
                        runCatching { activeRecorder?.release() }
                        recorder = null
                        recordingPath = null
                        isRecording = false
                        if (discardPath != null) runCatching { java.io.File(discardPath).delete() }
                    }) {
                        Icon(Icons.Filled.Close, "إلغاء التسجيل", tint = Color(0xFFFF6685))
                    }
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

private data class CloudReel(
    val id: String,
    val ownerUid: String,
    val caption: String,
    val videoUrl: String,
    val storagePath: String,
    val createdAtLabel: String
)

@Composable
private fun ReelsScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var reels by remember { mutableStateOf<List<CloudReel>>(emptyList()) }
    var selected by remember { mutableStateOf<CloudReel?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var caption by remember { mutableStateOf("") }
    val configured = remember(context) {
        FirebaseApp.getApps(context.applicationContext).isNotEmpty()
            && FirebaseAuth.getInstance().currentUser != null
    }
    val auth = remember(configured) { if (configured) FirebaseAuth.getInstance() else null }
    val db = remember(configured) { if (configured) FirebaseFirestore.getInstance() else null }
    val storage = remember(configured) { if (configured) FirebaseStorage.getInstance() else null }

    fun loadReels() {
        if (db == null || auth?.currentUser == null) {
            error = "خدمة Firebase غير مهيأة؛ لن نعرض مقاطع تجريبية."
            reels = emptyList()
            return
        }
        scope.launch {
            busy = true
            runCatching {
                db.collection("reels")
                    .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                    .limit(50)
                    .get().await().documents.mapNotNull { doc ->
                        val url = doc.getString("videoUrl") ?: return@mapNotNull null
                        val owner = doc.getString("ownerUid") ?: return@mapNotNull null
                        val path = doc.getString("storagePath") ?: return@mapNotNull null
                        CloudReel(
                            id = doc.id,
                            ownerUid = owner,
                            caption = doc.getString("caption").orEmpty(),
                            videoUrl = url,
                            storagePath = path,
                            createdAtLabel = doc.getTimestamp("createdAt")?.toDate()?.toString().orEmpty()
                        )
                    }
            }.onSuccess {
                reels = it
                if (selected?.id !in it.map { reel -> reel.id }) selected = it.firstOrNull()
                error = if (it.isEmpty()) "لا توجد مقاطع منشورة بعد. أضف أول مقطع حقيقي إلى موجز IMI." else null
            }.onFailure {
                error = "تعذر تحميل موجز Reels من السحابة: ${it.localizedMessage ?: "خطأ غير معروف"}"
            }
            busy = false
        }
    }

    val picker = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            val uid = auth?.currentUser?.uid
            if (uid == null || storage == null || db == null) {
                error = "يجب تسجيل الدخول إلى Firebase قبل نشر مقطع."
            } else {
                scope.launch {
                    busy = true
                    error = null
                    runCatching {
                        val mime = context.contentResolver.getType(uri)
                            ?: throw IllegalArgumentException("تعذر تحديد نوع الفيديو")
                        require(mime in listOf("video/mp4", "video/webm")) { "الصيغة المدعومة حالياً MP4 أو WebM فقط." }
                        val id = db.collection("reels").document().id
                        val extension = if (mime == "video/webm") "webm" else "mp4"
                        val path = "reels/$uid/$id.$extension"
                        val ref = storage.reference.child(path)
                        val metadata = StorageMetadata.Builder().setContentType(mime).build()
                        ref.putFile(uri, metadata).await()
                        val url = ref.downloadUrl.await().toString()
                        db.collection("reels").document(id).set(
                            mapOf(
                                "ownerUid" to uid,
                                "caption" to caption.trim().take(300),
                                "videoUrl" to url,
                                "storagePath" to path,
                                "contentType" to mime,
                                "createdAt" to FieldValue.serverTimestamp()
                            )
                        ).await()
                        caption = ""
                    }.onFailure {
                        error = "فشل رفع المقطع أو نشره: ${it.localizedMessage ?: "خطأ غير معروف"}"
                    }
                    busy = false
                    loadReels()
                }
            }
        }
    }

    val player = remember(selected?.videoUrl) {
        selected?.videoUrl?.let { url ->
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(url))
                prepare()
                playWhenReady = false
            }
        }
    }
    DisposableEffect(player) { onDispose { player?.release() } }
    LaunchedEffect(configured) { loadReels() }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        PageHeader("Reels", "موجز فيديوهات منشورة على سحابة IMI") {
            IconAction(Icons.Filled.Refresh, "تحديث الموجز") { loadReels() }
        }
        OutlinedTextField(
            value = caption,
            onValueChange = { caption = it.take(300) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("وصف المقطع (اختياري)") }
        )
        Button(
            onClick = { picker.launch(arrayOf("video/mp4", "video/webm")) },
            enabled = configured && !busy,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Filled.CloudUpload, null)
            Spacer(Modifier.width(8.dp))
            Text("نشر فيديو من الهاتف إلى السحابة")
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        error?.let { Text(it, color = ImiMuted, fontSize = 12.sp) }
        if (selected != null && player != null) {
            Surface(color = Color.Black, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().weight(1f)) {
                AndroidView(
                    factory = { viewContext -> PlayerView(viewContext).apply { this.player = player; useController = true } },
                    update = { it.player = player },
                    modifier = Modifier.fillMaxSize()
                )
            }
            Text(selected?.caption?.ifBlank { "بدون وصف" } ?: "", color = ImiText, maxLines = 2)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        val reel = selected ?: return@OutlinedButton
                        runCatching {
                            val request = DownloadManager.Request(android.net.Uri.parse(reel.videoUrl))
                                .setTitle("IMI Reel ${reel.id}")
                                .setDescription("تنزيل مقطع من IMI")
                                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "IMI-${reel.id}.mp4")
                            (context.getSystemService(android.content.Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                            Toast.makeText(context, "بدأ تنزيل المقطع", Toast.LENGTH_SHORT).show()
                        }.onFailure {
                            Toast.makeText(context, "تعذر بدء التنزيل: ${it.localizedMessage}", Toast.LENGTH_LONG).show()
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Filled.Download, null)
                    Spacer(Modifier.width(6.dp))
                    Text("تحميل الفيديو")
                }
                if (selected?.ownerUid == auth?.currentUser?.uid) {
                    OutlinedButton(onClick = {
                        val reel = selected ?: return@OutlinedButton
                        scope.launch {
                            busy = true
                            runCatching {
                                db?.collection("reels")?.document(reel.id)?.delete()?.await()
                                storage?.reference?.child(reel.storagePath)?.delete()?.await()
                            }.onFailure { error = "تعذر حذف المقطع: ${it.localizedMessage}" }
                            busy = false
                            selected = null
                            loadReels()
                        }
                    }) { Icon(Icons.Filled.DeleteOutline, null); Text("حذف") }
                }
            }
        } else if (!busy) {
            Surface(color = ImiSurface, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().weight(1f)) {
                Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(Icons.Filled.VideoLibrary, null, tint = ImiBlue, modifier = Modifier.size(52.dp))
                    Text("موجز Reels السحابي", color = ImiText, fontWeight = FontWeight.Bold)
                    Text("لن نعرض أسماء أو فيديوهات تجريبية. ستظهر هنا المقاطع التي يرفعها المستخدمون فعلياً بعد تهيئة Firebase.", color = ImiMuted, fontSize = 12.sp)
                }
            }
        }
        if (reels.isNotEmpty()) {
            Text("المقاطع المنشورة (${reels.size})", color = ImiText, fontWeight = FontWeight.SemiBold)
            LazyColumn(Modifier.heightIn(max = 150.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(reels, key = { it.id }) { reel ->
                    Surface(
                        color = if (selected?.id == reel.id) ImiBlue.copy(alpha = .18f) else ImiSurface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().clickable { selected = reel }
                    ) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.PlayCircle, null, tint = ImiBlue)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(reel.caption.ifBlank { "مقطع فيديو" }, color = ImiText, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("معرّف الناشر: ${reel.ownerUid.take(8)}", color = ImiMuted, fontSize = 10.sp)
                            }
                            IconButton(onClick = {
                                selected = reel
                                runCatching {
                                    val request = DownloadManager.Request(android.net.Uri.parse(reel.videoUrl))
                                        .setTitle("IMI Reel ${reel.id}")
                                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "IMI-${reel.id}.mp4")
                                    (context.getSystemService(android.content.Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                                }.onFailure { error = "تعذر التنزيل: ${it.localizedMessage}" }
                            }) { Icon(Icons.Filled.Download, "تحميل", tint = ImiMuted) }
                        }
                    }
                }
            }
        }
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
    var bio by remember(profilePrefs) { mutableStateOf(profilePrefs.getString("bio", "") ?: "") }
    var phoneNumber by remember(profilePrefs) { mutableStateOf(profilePrefs.getString("phone_number", "") ?: "") }
    var languages by remember(profilePrefs) { mutableStateOf(profilePrefs.getString("languages", "العربية") ?: "العربية") }
    var savingAccount by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var profileSection by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    var publishingProfile by remember { mutableStateOf(false) }
    var cloudProfileMessage by remember { mutableStateOf<String?>(null) }
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
                Button(
                    enabled = !publishingProfile && displayName.trim().length >= 2,
                    onClick = {
                        publishingProfile = true
                        cloudProfileMessage = null
                        scope.launch {
                            runCatching {
                                check(com.google.firebase.FirebaseApp.getApps(context.applicationContext).isNotEmpty()) {
                                    "إعداد Firebase غير موجود؛ لا يمكن نشر الملف."
                                }
                                val auth = com.google.firebase.auth.FirebaseAuth.getInstance()
                                val uid = auth.currentUser?.uid
                                    ?: auth.signInAnonymously().await().user?.uid
                                    ?: error("تعذر إنشاء الجلسة السحابية")
                                var photoPath: String? = null
                                avatarUri?.let { selectedAvatar ->
                                    val uri = android.net.Uri.parse(selectedAvatar)
                                    val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                                    require(mimeType in setOf("image/jpeg", "image/png", "image/webp")) {
                                        "صيغة الصورة غير مدعومة؛ استخدم JPEG أو PNG أو WebP."
                                    }
                                    val extension = when (mimeType) {
                                        "image/png" -> "png"
                                        "image/webp" -> "webp"
                                        else -> "jpg"
                                    }
                                    val avatarRef = com.google.firebase.storage.FirebaseStorage.getInstance()
                                        .reference.child("users/$uid/avatars/avatar.$extension")
                                    avatarRef.putFile(
                                        uri,
                                        com.google.firebase.storage.StorageMetadata.Builder()
                                            .setContentType(mimeType)
                                            .build()
                                    ).await()
                                    photoPath = avatarRef.path
                                }
                                val publicProfile = mutableMapOf<String, Any>(
                                    "uid" to uid,
                                    "displayName" to displayName.trim().take(60),
                                    "city" to city.trim().take(80),
                                    "updatedAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                                )
                                photoPath?.let { publicProfile["photoPath"] = it }
                                com.google.firebase.firestore.FirebaseFirestore.getInstance()
                                    .collection("publicProfiles").document(uid)
                                    .set(publicProfile).await()
                                photoPath?.let { path ->
                                    com.google.firebase.firestore.FirebaseFirestore.getInstance()
                                        .collection("users").document(uid)
                                        .set(mapOf("photoPath" to path), com.google.firebase.firestore.SetOptions.merge())
                                        .await()
                                }
                                uid
                            }.onSuccess {
                                cloudProfileMessage = "تم نشر اسمك ومدينتك في دليل IMI. معرّف الحساب السحابي: " + it.take(10)
                            }.onFailure {
                                cloudProfileMessage = it.localizedMessage ?: "تعذر نشر الملف السحابي"
                            }
                            publishingProfile = false
                        }
                    }
                ) {
                    if (publishingProfile) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Filled.CloudUpload, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(if (publishingProfile) "جارٍ النشر..." else "نشر الملف للبحث")
                }
                cloudProfileMessage?.let {
                    Text(it, color = if (it.startsWith("تم نشر")) ImiGreen else Color(0xFFFFA0A0), fontSize = 11.sp)
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
                    OutlinedTextField(value = bio, onValueChange = {
                        bio = it
                        profilePrefs.edit().putString("bio", it).apply()
                    }, label = { Text("نبذة عنك") }, minLines = 2, maxLines = 4)
                    OutlinedTextField(value = languages, onValueChange = {
                        languages = it
                        profilePrefs.edit().putString("languages", it).apply()
                    }, label = { Text("اللغات التي تتحدثها") }, supportingText = { Text("افصل بين اللغات بفاصلة: العربية، الفرنسية، الإنجليزية") })
                    OutlinedTextField(value = phoneNumber, onValueChange = {
                        phoneNumber = it
                        profilePrefs.edit().putString("phone_number", it).apply()
                    }, label = { Text("رقم الهاتف مع رمز الدولة") }, singleLine = true, supportingText = { Text("مثال: +212… — لا يظهر للآخرين قبل توثيقه") })
                    Text("توثيق رقم الهاتف عبر WhatsApp OTP", color = ImiBlue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text("سيُفعّل إرسال الرمز بعد ربط خادم IMI بمنصة WhatsApp Business. لم يتم إرسال رمز أو توثيق الرقم بعد.", color = ImiMuted, fontSize = 11.sp)
                    Button(enabled = !savingAccount && displayName.trim().length >= 2, onClick = {
                        savingAccount = true
                        scope.launch {
                            runCatching {
                                check(com.google.firebase.FirebaseApp.getApps(context.applicationContext).isNotEmpty()) {
                                    "إعداد Firebase غير موجود؛ لا يمكن حفظ الملف سحابياً."
                                }
                                val auth = com.google.firebase.auth.FirebaseAuth.getInstance()
                                val uid = auth.currentUser?.uid
                                    ?: auth.signInAnonymously().await().user?.uid
                                    ?: error("تعذر إنشاء الجلسة السحابية")
                                com.google.firebase.firestore.FirebaseFirestore.getInstance()
                                    .collection("users").document(uid)
                                    .set(mapOf(
                                        "displayName" to displayName.trim().take(60),
                                        "city" to city.trim().take(80),
                                        "bio" to bio.trim().take(300),
                                        "languages" to languages.split(",").map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(10),
                                        "updatedAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                                    ), com.google.firebase.firestore.SetOptions.merge()).await()
                            }.onSuccess {
                                cloudProfileMessage = "تم حفظ معلومات حسابك الخاصة في السحابة."
                            }.onFailure {
                                cloudProfileMessage = it.localizedMessage ?: "تعذر حفظ معلومات الحساب"
                            }
                            savingAccount = false
                        }
                    }) {
                        if (savingAccount) CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Filled.CloudDone, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(if (savingAccount) "جارٍ الحفظ…" else "حفظ معلومات الحساب")
                    }
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
        Text("معرّف IMI الظاهر أعلاه محلي للجهاز. زر نشر الملف يرفع الاسم والمدينة والصورة المختارة إلى الملف العام المحدود؛ رقم الهاتف لا يُنشر.", color = ImiMuted, fontSize = 11.sp)
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
