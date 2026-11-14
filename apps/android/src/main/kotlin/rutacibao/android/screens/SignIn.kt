package rutacibao.android.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import rutacibao.android.R
import rutacibao.android.design.Chip
import rutacibao.android.design.Field
import rutacibao.android.design.IconDisc
import rutacibao.android.design.Ink
import rutacibao.android.design.LocalAppGraph
import rutacibao.android.design.Mark
import rutacibao.android.design.Metrics
import rutacibao.android.design.Pill
import rutacibao.android.design.PillKind
import rutacibao.android.design.Type
import rutacibao.android.design.rise
import rutacibao.presentation.auth.SignInError
import rutacibao.presentation.auth.SignInUiState
import rutacibao.presentation.auth.SignInViewModel

/** Sign-in by one-time code, phone or email, over whatever asked for it. */
@Composable
fun SignInDialog(onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val graph = LocalAppGraph.current
        val vm: SignInViewModel = viewModel(key = "sign-in") { graph.viewModels.signIn() }
        val state by vm.state.collectAsStateWithLifecycle()
        LaunchedEffect(state.step) { if (state.step == SignInUiState.Step.Done) onDismiss() }
        Box(Modifier.fillMaxSize().background(Ink.colors.paper).systemBarsPadding().imePadding(), Alignment.TopCenter) {
            Column(Modifier.widthIn(max = 480.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)) {
                val verifying = state.step == SignInUiState.Step.Verify
                IconDisc(if (verifying) Icons.AutoMirrored.Outlined.ArrowBack else Icons.Outlined.Close, stringResource(if (verifying) R.string.sign_in_change else R.string.common_close),
                    { if (verifying) vm.editDestination() else onDismiss() }, Modifier.padding(top = 10.dp))
                Mark(44.dp, Modifier.padding(top = 28.dp).rise(0))
                AnimatedContent(verifying, transitionSpec = {
                    (fadeIn() + slideInHorizontally { if (targetState) it / 8 else -it / 8 }) togetherWith (fadeOut() + slideOutHorizontally { if (targetState) -it / 8 else it / 8 })
                }, label = "step") { second ->
                    if (second) Verify(state, vm) else Enter(state, vm)
                }
            }
        }
    }
}

@Composable
private fun Enter(state: SignInUiState, vm: SignInViewModel) {
    Column {
        Text(stringResource(R.string.sign_in_title), style = Type.display, color = Ink.colors.ink, modifier = Modifier.padding(top = 22.dp).rise(1))
        Text(stringResource(R.string.sign_in_lede), style = Type.body, color = Ink.colors.ink2, modifier = Modifier.padding(top = 8.dp).rise(2))
        Row(Modifier.padding(top = 28.dp).rise(3), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip(stringResource(R.string.sign_in_phone), state.method == SignInUiState.Method.Phone, { vm.selectMethod(SignInUiState.Method.Phone) }, icon = Icons.Outlined.Phone)
            Chip(stringResource(R.string.sign_in_email), state.method == SignInUiState.Method.Email, { vm.selectMethod(SignInUiState.Method.Email) }, icon = Icons.Outlined.MailOutline)
        }
        if (state.method == SignInUiState.Method.Phone) {
            Field(state.phone, vm::updatePhone, stringResource(R.string.sign_in_phone_placeholder), Modifier.padding(top = 12.dp).rise(4), keyboard = KeyboardOptions(keyboardType = KeyboardType.Phone), onDone = vm::submit)
        } else {
            Field(state.email, vm::updateEmail, stringResource(R.string.sign_in_email_placeholder), Modifier.padding(top = 12.dp).rise(4), keyboard = KeyboardOptions(keyboardType = KeyboardType.Email), onDone = vm::submit)
        }
        Problem(state.error)
        Pill(stringResource(R.string.sign_in_send_code), vm::submit, Modifier.padding(top = 16.dp).fillMaxWidth().rise(5), enabled = state.canSubmit, busy = state.busy)
        Text(stringResource(R.string.sign_in_terms), style = Type.caption, color = Ink.colors.ink3, modifier = Modifier.padding(top = 14.dp).rise(6))
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Verify(state: SignInUiState, vm: SignInViewModel) {
    Column {
        Text(stringResource(R.string.sign_in_verify_title), style = Type.display, color = Ink.colors.ink, modifier = Modifier.padding(top = 22.dp))
        Text(stringResource(R.string.sign_in_verify_lede, state.destination), style = Type.body, color = Ink.colors.ink2, modifier = Modifier.padding(top = 8.dp))
        CodeBoxes(state.code, failed = state.error != null, modifier = Modifier.padding(top = 28.dp)) { code ->
            vm.updateCode(code)
            if (code.length == 6 && !state.busy) vm.verify()
        }
        Problem(state.error)
        Pill(stringResource(R.string.sign_in_verify), vm::verify, Modifier.padding(top = 16.dp).fillMaxWidth(), enabled = state.code.length == 6, busy = state.busy)
        Pill(
            if (state.resendIn > 0) stringResource(R.string.sign_in_resend_in, state.resendIn.toString()) else stringResource(R.string.sign_in_resend),
            vm::resend, Modifier.padding(top = 14.dp), kind = PillKind.Outline, compact = true, enabled = state.resendIn <= 0 && !state.busy,
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Problem(error: SignInError?) {
    if (error == null) return
    val text = stringResource(when (error) {
        SignInError.PhoneInvalid -> R.string.sign_in_phone_invalid
        SignInError.EmailInvalid -> R.string.sign_in_email_invalid
        SignInError.CodeInvalid -> R.string.sign_in_code_invalid
        SignInError.CodeExpired -> R.string.sign_in_code_expired
        SignInError.TooManyAttempts -> R.string.sign_in_too_many_attempts
        SignInError.RateLimited -> R.string.sign_in_rate_limited
        SignInError.SendFailed -> R.string.sign_in_send_failed
        SignInError.Offline -> R.string.common_offline
    })
    Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.ErrorOutline, null, tint = Ink.colors.danger)
        Text(text, style = Type.callout, color = Ink.colors.danger)
    }
}

/** Six cells over one hidden field: each digit lands in its own box. */
@Composable
fun CodeBoxes(code: String, failed: Boolean, modifier: Modifier = Modifier, onChange: (String) -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val p = Ink.colors
    BasicTextField(
        value = code,
        onValueChange = { onChange(it.filter(Char::isDigit).take(6)) },
        modifier = modifier.fillMaxWidth().focusRequester(focus),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        cursorBrush = SolidColor(androidx.compose.ui.graphics.Color.Transparent),
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(6) { index ->
                    val shape = RoundedCornerShape(Metrics.radiusField)
                    val active = index == code.length.coerceAtMost(5)
                    Box(
                        Modifier.weight(1f).height(60.dp).background(p.paper2, shape).border(1.5.dp, if (failed) p.danger else if (active) p.ink else androidx.compose.ui.graphics.Color.Transparent, shape),
                        Alignment.Center,
                    ) { Text(code.getOrNull(index)?.toString().orEmpty(), style = Type.title.copy(fontSize = 26.sp), color = p.ink, textAlign = TextAlign.Center) }
                }
            }
        },
    )
}
