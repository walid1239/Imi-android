package com.walid.chat.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

private val AuthBackground = Color(0xFF07090F)
private val AuthSurface = Color(0xFF111522)
private val AuthBlue = Color(0xFF3D6BFF)
private val AuthText = Color(0xFFF4F6FC)
private val AuthMuted = Color(0xFF929BB0)

@Composable
internal fun AuthScreen(auth: FirebaseAuth?, setupError: String? = null) {
    var registering by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf(setupError) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier.fillMaxSize().background(AuthBackground).padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = AuthSurface,
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(
                modifier = Modifier.padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("IMI", color = AuthBlue, fontSize = 34.sp, fontWeight = FontWeight.Black)
                Text(
                    if (registering) "إنشاء حساب جديد" else "تسجيل الدخول",
                    color = AuthText,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "ادخل إلى حسابك لمزامنة محادثاتك والبحث عن الأصدقاء.",
                    color = AuthMuted,
                    fontSize = 13.sp
                )
                if (registering) {
                    OutlinedTextField(
                        value = displayName,
                        onValueChange = { displayName = it.take(60) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("الاسم الظاهر") },
                        enabled = auth != null && !busy
                    )
                }
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("البريد الإلكتروني") },
                    enabled = auth != null && !busy
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    label = { Text("كلمة المرور") },
                    enabled = auth != null && !busy
                )
                Button(
                    onClick = {
                        val currentAuth = auth ?: return@Button
                        val cleanEmail = email.trim()
                        val cleanName = displayName.trim()
                        if (!cleanEmail.contains("@") || password.length < 6 ||
                            (registering && cleanName.length < 2)) {
                            message = if (registering)
                                "أدخل بريداً صحيحاً واسماً من حرفين على الأقل وكلمة مرور من 6 أحرف."
                            else "أدخل بريداً صحيحاً وكلمة مرور من 6 أحرف على الأقل."
                            return@Button
                        }
                        busy = true
                        message = null
                        scope.launch {
                            try {
                                val result = if (registering) {
                                    currentAuth.createUserWithEmailAndPassword(cleanEmail, password).await()
                                } else {
                                    currentAuth.signInWithEmailAndPassword(cleanEmail, password).await()
                                }
                                val user = result.user ?: error("لم يُرجع Firebase حساباً صالحاً.")
                                val name = if (registering) cleanName
                                    else user.displayName?.takeIf { it.isNotBlank() }
                                        ?: cleanEmail.substringBefore("@")
                                val db = FirebaseFirestore.getInstance(currentAuth.app)
                                val batch = db.batch()
                                val now = FieldValue.serverTimestamp()
                                batch.set(db.collection("users").document(user.uid), mapOf(
                                    "displayName" to name,
                                    "city" to "",
                                    "updatedAt" to now
                                ), com.google.firebase.firestore.SetOptions.merge())
                                batch.set(db.collection("publicProfiles").document(user.uid), mapOf(
                                    "uid" to user.uid,
                                    "displayName" to name,
                                    "city" to "",
                                    "updatedAt" to now
                                ), com.google.firebase.firestore.SetOptions.merge())
                                batch.commit().await()
                                password = ""
                            } catch (error: Exception) {
                                message = when {
                                    error.message?.contains("network", ignoreCase = true) == true ->
                                        "تعذر الاتصال بالإنترنت. تحقق من الشبكة ثم أعد المحاولة."
                                    error.message?.contains("already in use", ignoreCase = true) == true ->
                                        "هذا البريد مسجل مسبقاً. انتقل إلى تسجيل الدخول."
                                    error.message?.contains("password", ignoreCase = true) == true ->
                                        "كلمة المرور غير صحيحة أو أقصر من المطلوب."
                                    else -> error.localizedMessage ?: "تعذر إكمال تسجيل الدخول."
                                }
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled = auth != null && !busy,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = AuthBlue)
                ) {
                    if (busy) CircularProgressIndicator(color = Color.White)
                    else Text(if (registering) "إنشاء الحساب" else "دخول", color = Color.White)
                }
                TextButton(
                    enabled = auth != null && !busy,
                    onClick = { registering = !registering; message = null }
                ) {
                    Text(
                        if (registering) "لديك حساب؟ سجّل الدخول" else "ليس لديك حساب؟ أنشئ حساباً",
                        color = AuthBlue
                    )
                }
                message?.let {
                    Text(it, color = Color(0xFFFFB4A9), fontSize = 12.sp)
                }
                if (auth == null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "الاتصال غير متاح لأن إعداد Firebase لم يصل إلى التطبيق. لن يتم إنشاء حساب محلي وهمي.",
                        color = AuthMuted,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}
