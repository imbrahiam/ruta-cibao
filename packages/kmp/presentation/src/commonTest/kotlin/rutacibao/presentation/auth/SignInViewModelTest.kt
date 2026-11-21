package rutacibao.presentation.auth

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import rutacibao.core.AppConfig
import rutacibao.core.SecureStore
import rutacibao.data.AuthRepository
import rutacibao.data.Session
import rutacibao.presentation.auth.SignInUiState.Step
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** MockEngine answers on another thread; wait (in real time) for the state to get there. */
private suspend fun SignInViewModel.await(predicate: (SignInUiState) -> Boolean) {
    kotlinx.coroutines.withContext(Dispatchers.Default) {
        kotlinx.coroutines.withTimeout(5_000) { state.first(predicate) }
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignInViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val config = AppConfig("https://example.test", "rutacibao-test", AppConfig.Variant.Development, AppConfig.Platform.Ios)

    private class MemoryStore : SecureStore {
        val values = mutableMapOf<String, String>()
        override fun read(key: String) = values[key]
        override fun write(key: String, value: String) { values[key] = value }
        override fun delete(key: String) { values.remove(key) }
    }

    @BeforeTest fun setUp() = Dispatchers.setMain(dispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun emailFlowRejectsAWrongCodeThenSignsIn() = runTest(dispatcher) {
        val paths = mutableListOf<String>()
        var verifyCalls = 0
        val session = Session(MemoryStore())
        val engine = MockEngine { request ->
            paths += request.url.encodedPath
            val json = headersOf(HttpHeaders.ContentType, "application/json")
            when {
                request.url.encodedPath.endsWith("/sign-in/email-otp") && verifyCalls++ == 0 ->
                    respond("""{"code":"INVALID_OTP","message":"bad"}""", HttpStatusCode.BadRequest, json)
                request.url.encodedPath.endsWith("/sign-in/email-otp") -> respond(
                    """{"status":true}""",
                    HttpStatusCode.OK,
                    headersOf(
                        HttpHeaders.ContentType to listOf("application/json"),
                        HttpHeaders.SetCookie to listOf("better-auth.session_token=abc; Path=/; HttpOnly"),
                    ),
                )
                else -> respond("""{"status":true}""", HttpStatusCode.OK, json)
            }
        }
        val client = io.ktor.client.HttpClient(engine) {
            install(rutacibao.data.sessionPluginForTests(session, config))
        }
        val vm = SignInViewModel(AuthRepository(client, config, session, rutacibao.data.PushRepository(rutacibao.data.createRutaApi(client, config), MemoryStore(), session)))

        assertEquals(SignInUiState.Method.Email, vm.state.value.method)
        vm.updateEmail(" Ana@Ejemplo.do ")
        assertTrue(vm.state.value.canSubmit)

        vm.submit()
        vm.await { it.step == Step.Verify }

        vm.updateCode("12a3456")
        vm.await { it.error != null }
        assertEquals(SignInError.CodeInvalid, vm.state.value.error)
        assertEquals(1, vm.state.value.failures)
        assertEquals("", vm.state.value.code)

        vm.updateCode("654321")
        vm.await { it.step == Step.Done }
        assertEquals(Step.Done, vm.state.value.step)
        assertTrue(session.isSignedIn.value)
        assertEquals(listOf("/api/auth/email-otp/send-verification-otp", "/api/auth/sign-in/email-otp", "/api/auth/sign-in/email-otp"), paths)
        advanceTimeBy(61_000)
    }

    @Test
    fun phoneCanBePickedAndValidatesTheNumber() = runTest(dispatcher) {
        val engine = MockEngine { error("no request expected") }
        val session = Session(MemoryStore())
        val client = io.ktor.client.HttpClient(engine)
        val vm = SignInViewModel(AuthRepository(client, config, session, rutacibao.data.PushRepository(rutacibao.data.createRutaApi(client, config), MemoryStore(), session)))
        assertEquals(listOf(SignInUiState.Method.Email, SignInUiState.Method.Phone), vm.state.value.methods)
        assertTrue(vm.state.value.isAvailable(SignInUiState.Method.Phone))
        vm.selectMethod(SignInUiState.Method.Phone)
        assertEquals(SignInUiState.Method.Phone, vm.state.value.method)
        vm.updatePhone("809")
        vm.submit(); runCurrent()
        assertEquals(SignInError.PhoneInvalid, vm.state.value.error)
        assertEquals(Step.Enter, vm.state.value.step)
    }

    @Test
    fun aRefusedSendWaitsAsLongAsTheServerAsksForThatAddressOnly() = runTest(dispatcher) {
        val engine = MockEngine {
            respond(
                """{"code":"OTP_RATE_LIMITED","message":"wait","retryAfter":24}""",
                HttpStatusCode.TooManyRequests,
                headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        val session = Session(MemoryStore())
        val client = io.ktor.client.HttpClient(engine)
        val vm = SignInViewModel(AuthRepository(client, config, session, rutacibao.data.PushRepository(rutacibao.data.createRutaApi(client, config), MemoryStore(), session)))

        vm.updateEmail("ana@ejemplo.do")
        vm.submit()
        vm.await { it.error != null }
        runCurrent()
        assertEquals(SignInError.RateLimited, vm.state.value.error)
        assertEquals(Step.Enter, vm.state.value.step)
        // Virtual time may tick while the response is awaited, so the count is checked by range.
        assertTrue(vm.state.value.resendIn in 1..24)
        assertTrue(!vm.state.value.canSubmit)

        // Another address is not held by this wait.
        vm.updateEmail("luis@ejemplo.do")
        assertEquals(0, vm.state.value.resendIn)
        assertTrue(vm.state.value.canSubmit)

        // Refused again: once the wait runs out, the button is back and the message is gone.
        vm.submit()
        vm.await { it.error != null }
        advanceTimeBy(30_000); runCurrent()
        assertEquals(0, vm.state.value.resendIn)
        assertEquals(null, vm.state.value.error)
        assertTrue(vm.state.value.canSubmit)
    }

    @Test
    fun goingBackToTheSameAddressResumesItsCodeAndKeepsTheWait() = runTest(dispatcher) {
        val sends = mutableListOf<String>()
        val engine = MockEngine { request ->
            sends += request.url.encodedPath
            respond("""{"status":true}""", HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        }
        val session = Session(MemoryStore())
        val client = io.ktor.client.HttpClient(engine)
        val vm = SignInViewModel(AuthRepository(client, config, session, rutacibao.data.PushRepository(rutacibao.data.createRutaApi(client, config), MemoryStore(), session)))

        vm.updateEmail("ana@ejemplo.do")
        vm.submit()
        vm.await { it.step == Step.Verify }
        runCurrent()
        assertTrue(vm.state.value.resendIn in 1..60)

        // "Cambiar": the same address offers its code back instead of a refused send.
        vm.editDestination()
        assertEquals(Step.Enter, vm.state.value.step)
        assertTrue(vm.state.value.hasSentCode)
        assertTrue(vm.state.value.canSubmit)

        // Another address is free to send; typing the first again brings the offer back.
        vm.updateEmail("luis@ejemplo.do")
        assertTrue(!vm.state.value.hasSentCode)
        vm.updateEmail("ana@ejemplo.do")
        assertTrue(vm.state.value.hasSentCode)

        vm.submit()
        assertEquals(Step.Verify, vm.state.value.step)
        assertTrue(vm.state.value.resendIn in 1..60)
        assertEquals(1, sends.size)

        // Once the code has expired, the first step sends a fresh one.
        vm.editDestination()
        advanceTimeBy(601_000); runCurrent()
        assertTrue(!vm.state.value.hasSentCode)
        assertEquals(0, vm.state.value.resendIn)
    }
}
