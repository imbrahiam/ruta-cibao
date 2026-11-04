package rutacibao.android.ui

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** System font; confident bold titles with slight negative tracking on large sizes. */
val RutaTypography: Typography = Typography().let { base ->
    base.copy(
        displaySmall = TextStyle(fontSize = 34.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
        headlineLarge = TextStyle(fontSize = 34.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
        headlineMedium = TextStyle(fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
        headlineSmall = TextStyle(fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
        titleLarge = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
        titleMedium = TextStyle(fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.2).sp),
        titleSmall = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.Normal),
        bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Normal),
        bodySmall = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Normal),
        labelLarge = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
        labelMedium = TextStyle(fontSize = 13.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
        labelSmall = TextStyle(fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.2.sp),
    )
}
