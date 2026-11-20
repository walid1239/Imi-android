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
    var statusBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }
    var statusDocumentId by remember { mutableStateOf<String?>(null) }
    var expiresAt by remember { mutableStateOf<Long?>(null) }
    var showComposer by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    var draftImageUri by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var configured by remember { mutableStateOf(false) }
    DisposableEffect(context) {
        val firebaseAuth = if (com.google.firebase.FirebaseApp.getApps(context.applicationContext).isNotEmpty()) {
            com.google.firebase.auth.FirebaseAuth.getInstance()
        } else null
        val listener = com.google.firebase.auth.FirebaseAuth.AuthStateListener { currentAuth ->
            configured = currentAuth.currentUser != null
        }
        firebaseAuth?.addAuthStateListener(listener)
        configured = firebaseAuth?.currentUser != null
        onDispose {
            if (firebaseAuth != null) firebaseAuth.removeAuthStateListener(listener)
        }
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

    LaunchedEffect(statusMediaPath, configured) {
        statusBitmap = null
        val path = statusMediaPath ?: return@LaunchedEffect
        val bucket = storage ?: return@LaunchedEffect
        runCatching {
            val bytes = bucket.reference.child(path).getBytes(20L * 1024L * 1024L).await()
            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                ?: error("تعذر فك صورة الحالة")
        }.onSuccess { statusBitmap = it }
            .onFailure { message = it.localizedMessage ?: "تعذر تحميل صورة الحالة من السحابة" }
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
                if (statusBitmap != null) {
                    Image(
                        bitmap = statusBitmap!!.asImageBitmap(),
                        contentDescription = "صورة الحالة",
                        modifier = Modifier.fillMaxWidth().heightIn(max = 280.dp).clip(RoundedCornerShape(14.dp)),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                    )
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = ImiBlue, strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("جارٍ تحميل صورة الحالة من السحابة…", color = ImiMuted, fontSize = 11.sp)
                    }
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
                                statusBitmap = null
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
                                val value = draft.trim().take(700)
                                val selectedMedia = draftImageUri?.let { selectedUri ->
                                    val uri = android.net.Uri.parse(selectedUri)
                                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                                    require(mime in setOf("image/jpeg", "image/png", "image/webp")) { "صيغة الصورة غير مدعومة." }
                                    uri to mime
                                }
                                val requestData = mutableMapOf<String, Any>()
                                if (value.isNotEmpty()) requestData["text"] = value
                                selectedMedia?.let { requestData["mediaType"] = it.second }
                                val callable = com.google.firebase.functions.FirebaseFunctions.getInstance()
                                    .getHttpsCallable("createStatus")
                                val response = callable.call(requestData).await()
                                val result = response.getData() as? Map<*, *>
                                    ?: error("استجابة خادم الحالات غير صالحة")
                                val id = result["statusId"] as? String
                                    ?: error("لم يُرجع الخادم معرّف الحالة")
                                val expiryMillis = (result["expiresAtMillis"] as? Number)?.toLong()
                                    ?: error("لم يُرجع الخادم وقت انتهاء الحالة")
                                val path = result["mediaPath"] as? String
                                val statusRef = db.collection("users").document(uid)
                                    .collection("statuses").document(id)
                                try {
                                    selectedMedia?.let { (uri, mime) ->
                                        require(!path.isNullOrBlank()) { "لم يُرجع الخادم مسار الصورة" }
                                        storage.reference.child(path).putFile(
                                            uri,
                                            com.google.firebase.storage.StorageMetadata.Builder().setContentType(mime).build()
                                        ).await()
                                    }
                                } catch (uploadError: Exception) {
                                    if (!path.isNullOrBlank()) {
                                        runCatching { storage.reference.child(path).delete().await() }
                                    }
                                    runCatching { statusRef.delete().await() }
                                    throw uploadError
                                }
                                mapOf(
                                    "__statusId" to id,
                                    "text" to value,
                                    "mediaPath" to path,
                                    "expiresAtMillis" to expiryMillis
                                )
                            }.onSuccess { data ->
                                statusDocumentId = data["__statusId"] as? String
                                statusText = data["text"] as? String
                                statusMediaPath = data["mediaPath"] as? String
                                expiresAt = (data["expiresAtMillis"] as? Number)?.toLong()
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
        if (db == null || storage == null || auth?.currentUser == null) {
            error = "خدمة Firebase غير مهيأة؛ لن نعرض مقاطع تجريبية."
            reels = emptyList()
            return
        }
        scope.launch {
            busy = true
            runCatching {
                db.collection("reels")
                    .whereEqualTo("status", "approved")
                    .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                    .limit(50)
                    .get().await().documents.mapNotNull { doc ->
                        val owner = doc.getString("ownerUid") ?: return@mapNotNull null
                        val path = doc.getString("storagePath") ?: return@mapNotNull null
                        val url = storage.reference.child(path).downloadUrl.await().toString()
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
                error = if (it.isEmpty()) "لا توجد مقاطع وافق عليها المشرف بعد." else null
            }.onFailure {
                error = "تعذر تحميل موجز Reels المعتمدة من السحابة: ${it.localizedMessage ?: "خطأ غير معروف"}"
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
                        val path = "reels/$uid/$id/video.$extension"
                        val ref = storage.reference.child(path)
                        val metadata = StorageMetadata.Builder().setContentType(mime).build()
                        ref.putFile(uri, metadata).await()
                        com.google.firebase.functions.FirebaseFunctions.getInstance()
                            .getHttpsCallable("submitReel")
                            .call(
                                mapOf(
                                    "reelId" to id,
                                    "caption" to caption.trim().take(300),
                                    "storagePath" to path,
                                    "contentType" to mime
                                )
                            ).await()
                        caption = ""
                        Toast.makeText(context, "تم رفع المقطع وإرساله للمراجعة؛ سيظهر بعد موافقة المشرف.", Toast.LENGTH_LONG).show()
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
    var avatarBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }

    // Decode a device-selected image immediately; if none is cached, restore the cloud avatar below.
    LaunchedEffect(avatarUri) {
        avatarBitmap = avatarUri?.let { savedUri ->
            runCatching {
                context.contentResolver.openInputStream(android.net.Uri.parse(savedUri))?.use { stream ->
                    android.graphics.BitmapFactory.decodeStream(stream)
                }
            }.getOrNull()
        }
    }

    // Restore private profile fields and the Storage avatar for this authenticated session.
    // The cloud photoPath is the durable reference; a local content URI is only a device cache.
    LaunchedEffect(context) {
        runCatching {
            if (com.google.firebase.FirebaseApp.getApps(context.applicationContext).isEmpty()) {
                return@LaunchedEffect
            }
            val auth = com.google.firebase.auth.FirebaseAuth.getInstance()
            val user = auth.currentUser ?: auth.signInAnonymously().await().user
                ?: error("تعذر فتح جلسة الحساب")
            val snapshot = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("users").document(user.uid).get().await()
            if (snapshot.exists()) {
                snapshot.getString("displayName")?.let {
                    displayName = it
                    profilePrefs.edit().putString("display_name", it).apply()
                }
                snapshot.getString("city")?.let {
                    city = it
                    profilePrefs.edit().putString("city", it).apply()
                }
                snapshot.getString("bio")?.let {
                    bio = it
                    profilePrefs.edit().putString("bio", it).apply()
                }
                val cloudLanguages = (snapshot.get("languages") as? List<*>)
                    ?.filterIsInstance<String>()?.joinToString(", ")
                cloudLanguages?.let {
                    languages = it
                    profilePrefs.edit().putString("languages", it).apply()
                }
                val cloudPhotoPath = snapshot.getString("photoPath")
                if (avatarUri == null && !cloudPhotoPath.isNullOrBlank()) {
                    val bytes = com.google.firebase.storage.FirebaseStorage.getInstance()
                        .reference.child(cloudPhotoPath).getBytes(10L * 1024L * 1024L).await()
                    avatarBitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        ?: error("تعذر قراءة صورة الحساب من السحابة")
                }
            }
        }.onFailure {
            cloudProfileMessage = it.localizedMessage ?: "تعذر تحميل الملف الخاص من السحابة"
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
                            bitmap = avatarBitmap!!.asImageBitmap(),
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
                                        .set(mapOf(
                                            "displayName" to displayName.trim().take(60),
                                            "city" to city.trim().take(80),
                                            "photoPath" to path,
                                            "updatedAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                                        ), com.google.firebase.firestore.SetOptions.merge())
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
            text = { Text("رقم الهاتف لا يُنشر في الملف العام. الاسم والمدينة والنبذة واللغات تُحفظ في مستندك الخاص على Firebase عند الضغط على «حفظ معلومات الحساب». إعدادات التحكم التفصيلية بالخصوصية لم تُفعّل بعد.", color = ImiMuted) },
            confirmButton = { TextButton(onClick = { profileSection = null }) { Text("حسناً") } }
        )
        "الإعدادات" -> AlertDialog(
            onDismissRequest = { profileSection = null },
            title = { Text("إعدادات IMI") },
            text = { Text("تستخدم النسخة الحالية جلسة Firebase مجهولة مؤقتة عند تهيئة المشروع. هذه الجلسة ليست حساباً موثقاً برقم هاتف، ولم يُفعّل WhatsApp OTP بعد. بعض البيانات والوظائف السحابية تعمل عند إعداد Firebase بشكل صحيح.", color = ImiMuted) },
            confirmButton = { TextButton(onClick = { profileSection = null }) { Text("إغلاق") } }
        )
    }
}
