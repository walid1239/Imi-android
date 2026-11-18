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
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            PageHeader("IMI", "مساحتك للتواصل والتعلّم") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconAction(Icons.Filled.Search, "بحث")
                    IconAction(Icons.Filled.NotificationsNone, "الإشعارات")
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
    var expiresAt by remember(prefs) { mutableStateOf(prefs.getLong("expires_at", 0L)) }
    var showComposer by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }

    LaunchedEffect(expiresAt) {
        if (statusText != null && expiresAt > 0L && System.currentTimeMillis() >= expiresAt) {
            prefs.edit().clear().apply()
            statusText = null
            expiresAt = 0L
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("الحالات", if (statusText == null) "أضف حالتك" else "حالتي", { showComposer = true })
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(58.dp).clickable { showComposer = true }
            ) {
                Box(Modifier.size(54.dp).clip(CircleShape).background(ImiSurface2), contentAlignment = Alignment.Center) {
                    if (statusText == null) Icon(Icons.Filled.Add, null, tint = ImiBlue, modifier = Modifier.size(25.dp))
                    else Text("أنا", color = ImiText, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(5.dp))
                Text(if (statusText == null) "أضف حالة" else "حالتي", color = ImiMuted, fontSize = 10.sp, maxLines = 1)
            }
            StoryBubble("أحمد", false, ImiPurple)
            StoryBubble("سارة", false, Color(0xFFE27B9B))
            StoryBubble("يوسف", false, Color(0xFF3AAE9B))
            StoryBubble("مريم", false, Color(0xFFE1A34B))
        }
        if (statusText != null) {
            Text(statusText!!, color = ImiMuted, fontSize = 12.sp, maxLines = 2)
            Text("تنتهي حالتك بعد 28 ساعة من نشرها على هذا الجهاز.", color = ImiMuted, fontSize = 10.sp)
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
            },
            confirmButton = {
                TextButton(onClick = {
                    val value = draft.trim()
                    if (value.isNotEmpty()) {
                        val expiry = System.currentTimeMillis() + 28L * 60L * 60L * 1000L
                        prefs.edit().putString("text", value).putLong("expires_at", expiry).apply()
                        statusText = value
                        expiresAt = expiry
                        draft = ""
                        showComposer = false
                    }
                }, enabled = draft.isNotBlank()) { Text("نشر") }
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
private fun ChatsScreen() {
    var query by remember { mutableStateOf("") }
    var opened by remember { mutableStateOf<String?>(null) }
    var draft by remember { mutableStateOf("") }
    val context = LocalContext.current
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
    val filtered = demoChats.filter { it.name.contains(query, true) }
    if (opened != null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconAction(Icons.Filled.ArrowForward, "رجوع") { opened = null }
                Spacer(Modifier.width(12.dp))
                Text(opened!!, color = ImiText, fontWeight = FontWeight.Bold, fontSize = 19.sp)
            }
            Spacer(Modifier.height(20.dp))
            Text("رسائلك محفوظة على هذا الجهاز فقط، وليست مرسلة عبر الإنترنت.", color = ImiMuted, fontSize = 12.sp)
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sentMessages[opened].orEmpty()) { message ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                        Surface(color = ImiBlue.copy(alpha = .2f), shape = RoundedCornerShape(16.dp)) {
                            Text(message, color = ImiText, modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp))
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(value = draft, onValueChange = { draft = it }, modifier = Modifier.weight(1f), placeholder = { Text("اكتب رسالة…") }, singleLine = true)
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
        return
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 22.dp)) {
        PageHeader("المحادثات", "ابقَ على تواصل") { IconAction(Icons.Filled.Edit, "محادثة جديدة") }
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
        Text("المحادثات المعروضة تجريبية؛ رسائلك الصادرة تُحفظ محلياً على الجهاز فقط.", color = ImiMuted, fontSize = 11.sp)
    }
}

@Composable
private fun ReelsScreen() {
    var liked by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().padding(18.dp)) {
        Column(Modifier.fillMaxWidth()) {
            PageHeader("Reels", "اكتشف مقاطع قصيرة")
            Spacer(Modifier.height(16.dp))
            Surface(color = ImiSurface, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth().weight(1f)) {
                Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Color(0xFF202C56), Color(0xFF17152E), ImiBackground))), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.PlayCircle, null, tint = ImiBlue, modifier = Modifier.size(64.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("مساحة مقاطع IMI", color = ImiText, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text("سيظهر المحتوى هنا بعد ربط مصدر الفيديوهات", color = ImiMuted, fontSize = 12.sp)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("محتوى تجريبي — لا توجد فيديوهات مرفوعة", color = ImiMuted, fontSize = 11.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = { liked = !liked }) { Icon(if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, null, tint = if (liked) Color(0xFFFF6685) else ImiMuted) }
            }
        }
    }
}

@Composable
private fun AcademyScreen() {
    Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PageHeader("IMI Academy", "تعلّم مهارات جديدة")
        Surface(color = ImiSurface, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Filled.School, null, tint = ImiPurple, modifier = Modifier.size(34.dp))
                Text("بوابتك إلى المعرفة", color = ImiText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("ستجد هنا الدروس والمسارات التعليمية عند إضافة المحتوى وربط الخدمة.", color = ImiMuted, fontSize = 13.sp, lineHeight = 20.sp)
            }
        }
        listOf("التعلّم الذاتي", "اللغات", "التقنية والبرمجة").forEachIndexed { index, title ->
            Surface(color = ImiSurface, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(ImiPurple.copy(alpha = .16f)), contentAlignment = Alignment.Center) {
                        Text("${index + 1}", color = Color(0xFFB69BFF), fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(title, color = ImiText, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                }
            }
        }
        Text("الأقسام المعروضة حالياً هي هيكل واجهة، وليست دروساً منشورة.", color = ImiMuted, fontSize = 11.sp)
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
    Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PageHeader("حسابي", "ملفك الشخصي") { IconAction(Icons.Filled.Settings, "الإعدادات") }
        Surface(color = ImiSurface, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Box(Modifier.size(86.dp).clip(CircleShape).background(ImiBlue.copy(alpha = .2f)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Person, null, tint = ImiBlue, modifier = Modifier.size(48.dp))
                }
                Text(displayName, color = ImiText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(city, color = ImiMuted, fontSize = 12.sp)
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
            Surface(color = ImiSurface, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth().clickable { }) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(label, color = ImiText, modifier = Modifier.weight(1f))
                    Icon(Icons.Filled.ChevronLeft, null, tint = ImiMuted)
                }
            }
        }
        Text("الاسم والمدينة محفوظان محلياً على هذا الجهاز؛ لم يُفعّل تسجيل الحساب أو المزامنة عبر الإنترنت.", color = ImiMuted, fontSize = 11.sp)
    }
}
