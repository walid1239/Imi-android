package com.walid.chat.ui

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
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue

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
    val context = LocalContext.current
    val firebaseReady = FirebaseApp.getApps(context.applicationContext).isNotEmpty()
    val auth = remember(firebaseReady) { if (firebaseReady) FirebaseAuth.getInstance() else null }
    var currentUser by remember(auth) { mutableStateOf(auth?.currentUser) }
    DisposableEffect(auth) {
        if (auth == null) {
            onDispose { }
        } else {
            val listener = FirebaseAuth.AuthStateListener { currentUser = it.currentUser }
            auth.addAuthStateListener(listener)
            onDispose { auth.removeAuthStateListener(listener) }
        }
    }
    IMITheme {
        when {
            !firebaseReady -> Surface(Modifier.fillMaxSize(), color = ImiBackground) {
                Text("إعداد Firebase غير موجود. أضف إعداد تطبيق Android الصحيح قبل تسجيل الدخول.", color = ImiMuted, modifier = Modifier.padding(24.dp))
            }
            currentUser == null -> LoginScreen()
            else -> AuthenticatedIMIApp(cloudSessionMessage)
        }
    }
}

@Composable
private fun AuthenticatedIMIApp(cloudSessionMessage: String?) {
    var selected by remember { mutableStateOf(ImiTab.Home) }
    Scaffold(
        containerColor = ImiBackground,
        bottomBar = { ImiBottomBar(selected) { selected = it } }
    ) { padding ->
        Column(Modifier.fillMaxSize().background(ImiBackground).padding(padding)) {
            if (cloudSessionMessage != null) {
                Text(
                    cloudSessionMessage,
                    color = ImiMuted,
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
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        PageHeader("الحالات", "حالات IMI النصية")
        Surface(color = ImiSurface, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("الحالات قيد التجهيز", color = ImiText, fontWeight = FontWeight.Bold)
                Text("تم إيقاف رفع الصور والفيديوهات مؤقتاً. ستُعاد الحالات النصية بعد نقل إنشائها إلى خادم IMI الموثوق، مع انتهاء صلاحية بعد 28 ساعة.", color = ImiMuted, fontSize = 12.sp, lineHeight = 19.sp)
            }
        }
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
    Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHeader("Reels", "مقاطع IMI القصيرة")
        Surface(color = ImiSurface, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ميزة Reels مؤجلة", color = ImiText, fontWeight = FontWeight.Bold)
                Text("رفع الفيديوهات وتشغيل موجز Reels غير متاح في المرحلة المجانية الأولى. لن يتصل التطبيق بـ Firebase Storage ولن يعرض أزرار رفع غير عاملة.", color = ImiMuted, fontSize = 12.sp, lineHeight = 19.sp)
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
    val auth = remember { FirebaseAuth.getInstance() }
    val currentUser = auth.currentUser
    val prefs = remember(context) { context.getSharedPreferences("imi_local_profile", android.content.Context.MODE_PRIVATE) }
    var name by remember(prefs) { mutableStateOf(prefs.getString("display_name", "مستخدم IMI") ?: "مستخدم IMI") }
    var city by remember(prefs) { mutableStateOf(prefs.getString("city", "المغرب") ?: "المغرب") }
    var bio by remember(prefs) { mutableStateOf(prefs.getString("bio", "") ?: "") }
    var languages by remember(prefs) { mutableStateOf(prefs.getString("languages", "العربية") ?: "العربية") }
    var linkEmail by remember { mutableStateOf("") }
    var linkPassword by remember { mutableStateOf("") }
    var accountMessage by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        PageHeader("حسابي", "ملفك الشخصي")
        Surface(color = ImiSurface, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Icon(Icons.Filled.Person, null, tint = ImiBlue, modifier = Modifier.size(48.dp))
                Text(name, color = ImiText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(city, color = ImiMuted, fontSize = 12.sp)
                Text(if (currentUser?.isAnonymous == true) "حساب ضيف — اربطه ببريد وكلمة مرور للاحتفاظ به على أجهزتك." else "حساب Firebase موحّد", color = ImiMuted, fontSize = 11.sp)
                Text("رفع الصور الشخصية مؤجل في المرحلة المجانية الأولى.", color = ImiMuted, fontSize = 11.sp)
                OutlinedButton(onClick = { editing = !editing }) { Text(if (editing) "إغلاق التعديل" else "تعديل الملف") }
                if (editing) {
                    OutlinedTextField(value = name, onValueChange = { name = it; prefs.edit().putString("display_name", it).apply() }, label = { Text("الاسم") }, singleLine = true)
                    OutlinedTextField(value = city, onValueChange = { city = it; prefs.edit().putString("city", it).apply() }, label = { Text("المدينة") }, singleLine = true)
                    OutlinedTextField(value = bio, onValueChange = { bio = it; prefs.edit().putString("bio", it).apply() }, label = { Text("نبذة عنك") }, minLines = 2, maxLines = 4)
                    OutlinedTextField(value = languages, onValueChange = { languages = it; prefs.edit().putString("languages", it).apply() }, label = { Text("اللغات التي تتحدثها") })
                    Button(enabled = !saving && name.trim().length >= 2, onClick = {
                        saving = true
                        scope.launch {
                            runCatching {
                                val uid = auth.currentUser?.uid ?: error("انتهت جلسة الدخول. سجّل الدخول مجدداً.")
                                FirebaseFirestore.getInstance().collection("users").document(uid).set(
                                    mapOf("displayName" to name.trim().take(60), "city" to city.trim().take(80), "bio" to bio.trim().take(300),
                                        "languages" to languages.split(",").map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(10),
                                        "updatedAt" to FieldValue.serverTimestamp()),
                                    com.google.firebase.firestore.SetOptions.merge()
                                ).await()
                            }.onSuccess { message = "تم حفظ معلومات الحساب النصية." }
                                .onFailure { message = it.localizedMessage ?: "تعذر حفظ معلومات الحساب" }
                            saving = false
                        }
                    }) {
                        if (saving) CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Filled.CloudDone, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(if (saving) "جارٍ الحفظ…" else "حفظ معلومات الحساب")
                    }
                }
                message?.let { Text(it, color = ImiMuted, fontSize = 11.sp) }
            }
        }
        if (currentUser?.isAnonymous == true) {
            Surface(color = ImiSurface, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("تحويل حساب الضيف إلى حساب دائم", color = ImiText, fontWeight = FontWeight.Bold)
                    Text("يربط Firebase البريد بالحساب الحالي ويحافظ على UID وبيانات هذا الحساب. إذا كان البريد مستخدماً في حساب آخر، لن نستبدل الحساب تلقائياً.", color = ImiMuted, fontSize = 11.sp, lineHeight = 18.sp)
                    OutlinedTextField(value = linkEmail, onValueChange = { linkEmail = it.trim() }, label = { Text("البريد الإلكتروني") }, singleLine = true)
                    OutlinedTextField(value = linkPassword, onValueChange = { linkPassword = it }, label = { Text("كلمة المرور (6 أحرف على الأقل)") }, singleLine = true)
                    Button(enabled = !saving && linkEmail.contains("@") && linkPassword.length >= 6, onClick = {
                        saving = true
                        accountMessage = null
                        scope.launch {
                            runCatching {
                                val guest = auth.currentUser ?: error("انتهت جلسة الضيف.")
                                check(guest.isAnonymous) { "هذا الحساب ليس حساب ضيف." }
                                guest.linkWithCredential(EmailAuthProvider.getCredential(linkEmail, linkPassword)).await()
                            }.onSuccess {
                                accountMessage = "تم ربط البريد بالحساب الحالي مع الحفاظ على UID."
                                linkPassword = ""
                            }.onFailure {
                                accountMessage = it.localizedMessage ?: "تعذر ربط البريد. إذا كان مستخدماً بحساب آخر فسجّل الدخول بذلك الحساب بعد التأكد من نقل بياناتك."
                            }
                            saving = false
                        }
                    }) { Text(if (saving) "جارٍ الربط…" else "ربط البريد بالحساب الحالي") }
                    accountMessage?.let { Text(it, color = ImiMuted, fontSize = 11.sp) }
                }
            }
        } else {
            currentUser?.email?.let { email ->
                Text("البريد المرتبط: $email", color = ImiMuted, fontSize = 12.sp)
            }
        }
    }
}
