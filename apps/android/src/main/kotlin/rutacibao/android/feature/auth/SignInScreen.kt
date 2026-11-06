package rutacibao.android.feature.auth

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import rutacibao.android.ui.CloseButton
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.util.UUID
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import rutacibao.android.R
import rutacibao.android.ui.BrandMark
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.LocalReducedMotion
import rutacibao.android.ui.rutaButtonColors
import rutacibao.presentation.auth.SignInError
import rutacibao.presentation.auth.SignInUiState
import rutacibao.presentation.auth.SignInUiState.Method
import rutacibao.presentation.auth.SignInUiState.Step
import rutacibao.presentation.auth.SignInViewModel

private const val CODE_LENGTH = 6

/** Full-screen sign-in. Fresh view model per presentation; dismisses itself after success. */
@Composable
fun SignInDialog(onDismiss: () -> Unit) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        val graph = LocalAppGraph.current
        val key = remember { UUID.randomUUID().toString() }
        val vm: SignInViewModel = viewModel(key = key) { graph.viewModels.signIn() }
        SignInScreen(vm, onClose = onDismiss)
    }
}

@Composable
private fun SignInScreen(vm: SignInViewModel, onClose: () -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    val reduced = LocalReducedMotion.current
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            if (state.step != Step.Done) {
                CloseButton(onClose, Modifier.padding(start = 8.dp, top = 4.dp), label = stringResource(R.string.sign_in_close))
            }
            AnimatedContent(
                targetState = state.step,
                modifier = Modifier.weight(1f),
                transitionSpec = {
                    if (reduced) {
                        fadeIn(tween(150)) togetherWith fadeOut(tween(150))
                    } else {
                        val forward = targetState.ordinal > initialState.ordinal
                        val dir = if (forward) 1 else -1
                        (slideInHorizontally(tween(320)) { it * dir } + fadeIn(tween(320))) togetherWith
                            (slideOutHorizontally(tween(320)) { -it * dir / 3 } + fadeOut(tween(200)))
                    }
                },
                label = "sign-in-step",
            ) { step ->
                when (step) {
                    Step.Enter -> EnterStep(state, vm)
                    Step.Verify -> VerifyStep(state, vm)
                    Step.Done -> DoneStep(onClose)
                }
            }
        }
    }
}

@Composable
private fun EnterStep(state: SignInUiState, vm: SignInViewModel) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).padding(horizontal = 24.dp)) {
            Spacer(Modifier.height(16.dp))
            BrandMark(64.dp, animate = true)
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.sign_in_title),
                style = MaterialTheme.typography.displaySmall,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.sign_in_lede),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(24.dp))
            val methods = listOf(Method.Phone to R.string.sign_in_phone, Method.Email to R.string.sign_in_email)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                methods.forEachIndexed { i, (m, label) ->
                    SegmentedButton(
                        selected = state.method == m,
                        onClick = { vm.selectMethod(m) },
                        shape = SegmentedButtonDefaults.itemShape(i, methods.size),
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                    ) { Text(stringResource(label)) }
                }
            }
            Spacer(Modifier.height(24.dp))
            val focus = remember { FocusRequester() }
            LaunchedEffect(state.method) { runCatching { focus.requestFocus() } }
            val invalid = state.error == SignInError.PhoneInvalid || state.error == SignInError.EmailInvalid
            if (state.method == Method.Phone) {
                FieldLabel(R.string.sign_in_phone_label)
                val text = state.phone
                FieldBox(error = state.error != null) {
                    Row(
                        Modifier.clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(horizontal = 10.dp, vertical = 6.dp),
                    ) { Text("🇩🇴 +1", style = MaterialTheme.typography.titleMedium) }
                    Spacer(Modifier.width(12.dp))
                    BigField(
                        value = TextFieldValue(text, TextRange(text.length)),
                        onValue = { vm.updatePhone(it.text) },
                        placeholder = stringResource(R.string.sign_in_phone_placeholder),
                        keyboard = KeyboardType.Phone,
                        onDone = vm::submit,
                        focus = focus,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (state.error == null || !invalid) {
                    Text(
                        stringResource(R.string.sign_in_phone_helper),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            } else {
                FieldLabel(R.string.sign_in_email_label)
                FieldBox(error = state.error != null) {
                    BigField(
                        value = TextFieldValue(state.email, TextRange(state.email.length)),
                        onValue = { vm.updateEmail(it.text) },
                        placeholder = stringResource(R.string.sign_in_email_placeholder),
                        keyboard = KeyboardType.Email,
                        onDone = vm::submit,
                        focus = focus,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            state.error?.let { ErrorLine(it, Modifier.padding(top = 8.dp)) }
        }
        Column(Modifier.padding(horizontal = 24.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = vm::submit,
                enabled = state.canSubmit || state.busy,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = CircleShape,
                colors = rutaButtonColors(),
            ) {
                if (state.busy) {
                    CircularProgressIndicator(Modifier.size(24.dp), color = LocalPalette.current.onAccent, strokeWidth = 2.5.dp)
                } else {
                    Text(stringResource(R.string.sign_in_send_code), style = MaterialTheme.typography.titleMedium)
                }
            }
            Text(
                stringResource(R.string.sign_in_terms),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun FieldLabel(res: Int) {
    Text(
        stringResource(res),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

@Composable
private fun FieldBox(error: Boolean, content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    val scheme = MaterialTheme.colorScheme
    Row(
        Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(scheme.surfaceContainer)
            .border(if (error) 2.dp else 1.dp, if (error) scheme.error else scheme.outline, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun BigField(
    value: TextFieldValue,
    onValue: (TextFieldValue) -> Unit,
    placeholder: String,
    keyboard: KeyboardType,
    onDone: () -> Unit,
    focus: FocusRequester,
    modifier: Modifier = Modifier,
) {
    val style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface, letterSpacing = (-0.3).sp)
    Box(modifier, Alignment.CenterStart) {
        if (value.text.isEmpty()) {
            Text(placeholder, style = style.copy(color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)), maxLines = 1)
        }
        BasicTextField(
            value = value,
            onValueChange = onValue,
            textStyle = style,
            singleLine = true,
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onDone() }),
            modifier = Modifier.fillMaxWidth().focusRequester(focus),
        )
    }
}

@Composable
private fun ErrorLine(error: SignInError, modifier: Modifier = Modifier) {
    val text = stringResource(
        when (error) {
            SignInError.PhoneInvalid -> R.string.sign_in_phone_invalid
            SignInError.EmailInvalid -> R.string.sign_in_email_invalid
            SignInError.CodeInvalid -> R.string.sign_in_code_invalid
            SignInError.CodeExpired -> R.string.sign_in_code_expired
            SignInError.TooManyAttempts -> R.string.sign_in_too_many_attempts
            SignInError.RateLimited -> R.string.sign_in_rate_limited
            SignInError.SendFailed -> R.string.sign_in_send_failed
            SignInError.Offline -> R.string.common_offline_body
        },
    )
    val danger = LocalPalette.current.dangerInk
    Row(
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(Icons.Filled.ErrorOutline, contentDescription = null, Modifier.size(20.dp), tint = danger)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = danger)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VerifyStep(state: SignInUiState, vm: SignInViewModel) {
    val reduced = LocalReducedMotion.current
    val haptics = LocalHapticFeedback.current
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    val shake = remember { Animatable(0f) }
    LaunchedEffect(state.failures) {
        if (state.failures == 0) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.Reject)
        if (!reduced) {
            for (x in listOf(-12f, 12f, -9f, 9f, -5f, 5f, 0f)) shake.animateTo(x, tween(45))
        }
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
        Spacer(Modifier.height(24.dp))
        Text(
            stringResource(R.string.sign_in_verify_title),
            style = MaterialTheme.typography.displaySmall,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.sign_in_verify_lede, state.destination),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(onClick = vm::editDestination, Modifier.defaultMinSize(minHeight = 48.dp)) {
            Text(stringResource(R.string.sign_in_change), style = MaterialTheme.typography.labelLarge)
        }
        Spacer(Modifier.height(16.dp))
        FieldLabel(R.string.sign_in_code_label)
        CodeCells(
            code = state.code,
            error = state.error != null,
            focus = focus,
            onCode = vm::updateCode,
            modifier = Modifier.offset { IntOffset(shake.value.dp.roundToPx(), 0) },
        )
        state.error?.let { ErrorLine(it, Modifier.padding(top = 12.dp)) }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.defaultMinSize(minHeight = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            when {
                state.busy -> CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.5.dp)
                state.resendIn > 0 -> Text(
                    stringResource(R.string.sign_in_resend_in, state.resendIn),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> TextButton(onClick = vm::resend, Modifier.defaultMinSize(minHeight = 48.dp)) {
                    Text(stringResource(R.string.sign_in_resend), style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

@Composable
internal fun CodeCells(code: String, error: Boolean, focus: FocusRequester, onCode: (String) -> Unit, modifier: Modifier = Modifier) {
    val scheme = MaterialTheme.colorScheme
    var focused by remember { mutableStateOf(false) }
    val reduced = LocalReducedMotion.current
    val caretAlpha = if (reduced) {
        1f
    } else {
        val a by rememberInfiniteTransition(label = "caret").animateFloat(
            initialValue = 1f,
            targetValue = 0f,
            animationSpec = infiniteRepeatable(tween(530), RepeatMode.Reverse),
            label = "caret-alpha",
        )
        a
    }
    Box(modifier.fillMaxWidth().height(56.dp)) {
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(CODE_LENGTH) { i ->
                val ch = code.getOrNull(i)
                val active = focused && i == code.length.coerceAtMost(CODE_LENGTH - 1)
                val borderColor = when {
                    error -> scheme.error
                    active -> scheme.primary
                    else -> scheme.outline
                }
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .clip(RoundedCornerShape(12.dp))
                        .background(scheme.surfaceContainer)
                        .border(if (error || active) 2.dp else 1.dp, borderColor, RoundedCornerShape(12.dp)),
                    Alignment.Center,
                ) {
                    if (ch != null) {
                        DigitText(ch)
                    } else if (active && !error) {
                        Box(Modifier.width(2.dp).height(26.dp).alpha(caretAlpha).background(scheme.primary))
                    }
                }
            }
        }
        // One hidden field drives all cells and receives SMS autofill.
        val fieldLabel = stringResource(R.string.sign_in_code_label)
        BasicTextField(
            value = TextFieldValue(code, TextRange(code.length)),
            onValueChange = { onCode(it.text) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
            cursorBrush = SolidColor(androidx.compose.ui.graphics.Color.Transparent),
            textStyle = TextStyle(color = androidx.compose.ui.graphics.Color.Transparent),
            singleLine = true,
            modifier = Modifier
                .matchParentSize()
                .alpha(0f)
                .focusRequester(focus)
                .onFocusChanged { focused = it.isFocused }
                .semantics {
                    contentType = ContentType.SmsOtpCode
                    contentDescription = fieldLabel
                },
        )
    }
}

@Composable
private fun DigitText(ch: Char) {
    val reduced = LocalReducedMotion.current
    val scale = remember(ch) { Animatable(if (reduced) 1f else 0.5f) }
    LaunchedEffect(ch) {
        if (!reduced) scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
    }
    Text(
        ch.toString(),
        style = MaterialTheme.typography.headlineMedium,
        modifier = Modifier.scale(scale.value),
    )
}

@Composable
private fun DoneStep(onDone: () -> Unit) {
    val reduced = LocalReducedMotion.current
    val scale = remember { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduced) scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
    }
    LaunchedEffect(Unit) {
        delay(900)
        onDone()
    }
    Column(
        Modifier.fillMaxSize().semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            Modifier.size(96.dp).scale(scale.value),
            tint = LocalPalette.current.success,
        )
        Text(stringResource(R.string.sign_in_welcome), style = MaterialTheme.typography.headlineSmall)
    }
}
