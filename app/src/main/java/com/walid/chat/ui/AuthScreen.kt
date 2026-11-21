package com.walid.chat.ui

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Composable
fun LoginScreen() {
    val context = LocalContext.current
    val background = Color(0xFF07090F)
    val surface = Color(0xFF111522)
    val blue = Color(0xFF3D6BFF)
    val textColor = Color(0xFFF4F6FC)
    val muted = Color(0xFF929BB0)
    val auth = remember { FirebaseAuth.getInstance() }
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var createAccount by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    val googleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            runCatching {
                GoogleSignIn.getSignedInAccountFromIntent(result.data).getResult(ApiException::class.java)
            }.onSuccess { account ->
                val idToken = account.idToken
                if (idToken.isNullOrBlank()) {
                    message = "تعذر الحصول على رمز Google. تحقق من إعداد OAuth في Firebase."
                } else {
                    busy = true
                    scope.launch {
                        runCatching {
                            val credential = GoogleAuthProvider.getCredential(idToken, null)
                            val currentUser = auth.currentUser
                            if (currentUser?.isAnonymous == true) {
                                currentUser.linkWithCredential(credential).await()
                            } else {
                                auth.signInWithCredential(credential).await()
                            }
                        }.onFailure {
                            message = if (it is FirebaseAuthUserCollisionException) {
                                "حساب Google مرتبط بحساب موجود. لم نغيّر جلسة الضيف الحالية؛ سجّل الدخول بالحساب الموجود."
                            } else it.localizedMessage ?: "تعذر تسجيل الدخول عبر Google."
                        }
                        busy = false
                    }
                }
            }.onFailure { message = it.localizedMessage ?: "لم يكتمل تسجيل الدخول عبر Google." }
        } else if (result.resultCode != Activity.RESULT_CANCELED) {
            message = "تعذر إكمال تسجيل الدخول عبر Google."
        }
    }

    Column(
        Modifier.fillMaxSize().background(background).padding(22.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Surface(color = surface, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("IMI", color = blue, fontSize = 30.sp, fontWeight = FontWeight.Black)
                Text(if (createAccount) "إنشاء حساب جديد" else "تسجيل الدخول", color = textColor, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("استخدم الحساب نفسه على الويب وAndroid. لا نستخدم OTP في هذه المرحلة.", color = muted, fontSize = 12.sp, lineHeight = 19.sp)
                OutlinedTextField(
                    value = email, onValueChange = { email = it.trim() },
                    modifier = Modifier.fillMaxWidth(), label = { Text("البريد الإلكتروني") },
                    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
                OutlinedTextField(
                    value = password, onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(), label = { Text("كلمة المرور") },
                    singleLine = true, visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
                Button(
                    enabled = !busy && email.contains("@") && password.length >= 6,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        busy = true
                        message = null
                        scope.launch {
                            runCatching {
                                if (createAccount) {
                                    val currentUser = auth.currentUser
                                    if (currentUser?.isAnonymous == true) {
                                        currentUser.linkWithCredential(EmailAuthProvider.getCredential(email, password)).await()
                                    } else {
                                        auth.createUserWithEmailAndPassword(email, password).await()
                                    }
                                } else {
                                    auth.signInWithEmailAndPassword(email, password).await()
                                }
                            }.onFailure {
                                message = if (it is FirebaseAuthUserCollisionException) {
                                    "البريد مرتبط بحساب موجود. لم نغيّر جلسة الضيف الحالية؛ سجّل الدخول بالحساب الموجود."
                                } else it.localizedMessage ?: "تعذر إتمام العملية."
                            }
                            busy = false
                        }
                    }
                ) { Text(if (busy) "جارٍ التنفيذ…" else if (createAccount) "إنشاء الحساب" else "دخول بالبريد وكلمة المرور") }
                TextButton(
                    enabled = !busy && email.contains("@"),
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        busy = true
                        scope.launch {
                            runCatching { auth.sendPasswordResetEmail(email).await() }
                                .onSuccess { message = "أرسلنا رابط إعادة تعيين كلمة المرور إذا كان البريد مسجلاً." }
                                .onFailure { message = it.localizedMessage ?: "تعذر إرسال رابط الاستعادة." }
                            busy = false
                        }
                    }
                ) { Text("نسيت كلمة المرور؟ إرسال رابط الاستعادة") }
                OutlinedButton(
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val id = context.resources.getIdentifier("default_web_client_id", "string", context.packageName)
                        if (id == 0) {
                            message = "تسجيل Google غير مهيأ لهذا التطبيق. تحقق من google-services.json وOAuth."
                        } else {
                            val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                .requestIdToken(context.getString(id))
                                .requestEmail()
                                .build()
                            googleLauncher.launch(GoogleSignIn.getClient(context, options).signInIntent)
                        }
                    }
                ) { Text("المتابعة باستخدام Google") }
                OutlinedButton(
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        busy = true
                        scope.launch {
                            runCatching { auth.signInAnonymously().await() }
                                .onFailure { message = it.localizedMessage ?: "تعذر إنشاء جلسة الضيف." }
                            busy = false
                        }
                    }
                ) { Text("الدخول كضيف") }
                TextButton(onClick = { createAccount = !createAccount; message = null }) {
                    Text(if (createAccount) "لديك حساب؟ تسجيل الدخول" else "ليس لديك حساب؟ إنشاء حساب")
                }
                message?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            }
        }
    }
}
