package com.walid.chat.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Background = Color(0xFF07090F)
val Surface = Color(0xFF111626)
val SurfaceRaised = Color(0xFF18213A)
val Blue = Color(0xFF3D6BFF)
val Purple = Color(0xFF6C3DFF)
val TextPrimary = Color(0xFFF5F7FF)
val TextMuted = Color(0xFF9AA5BD)
val DividerColor = Color(0xFF252E45)

private val DarkColors = darkColorScheme(
    primary = Blue,
    secondary = Purple,
    background = Background,
    surface = Surface,
    onPrimary = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

@Composable
fun IMITheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        typography = MaterialTheme.typography,
        content = content
    )
}
