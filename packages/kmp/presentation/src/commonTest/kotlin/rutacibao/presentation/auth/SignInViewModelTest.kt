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
    fun phoneFlowFormatsRejectsAWrongCodeThenSignsIn() = runTest(dispatcher) {
        val paths = mutableListOf<String>()
        var verifyCalls = 0
        val session = Session(MemoryStore())
        val engine = MockEngine { request ->
            paths += request.url.encodedPath
            val json = headersOf(HttpHeaders.ContentType, "application/json")
            when {
                request.url.encodedPath.endsWith("/verify") && verifyCalls++ == 0 ->
                    respond("""{"code":"INVALID_OTP","message":"bad"}""", HttpStatusCode.BadRequest, json)
                request.url.encodedPath.endsWith("/verify") -> respond(
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

        vm.updatePhone("(829) 555 0123")
        assertEquals("829-555-0123", vm.state.value.phone)
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
        assertEquals(listOf("/api/auth/phone-number/send-otp", "/api/auth/phone-number/verify", "/api/auth/phone-number/verify"), paths)
        advanceTimeBy(61_000)
    }

    @Test
    fun anInvalidNumberNeverLeavesTheDevice() = runTest(dispatcher) {
        val engine = MockEngine { error("no request expected") }
        val session = Session(MemoryStore())
        val client = io.ktor.client.HttpClient(engine)
        val vm = SignInViewModel(AuthRepository(client, config, session, rutacibao.data.PushRepository(rutacibao.data.createRutaApi(client, config), MemoryStore(), session)))
        vm.updatePhone("305-555-0123")
        vm.submit(); runCurrent()
        assertEquals(SignInError.PhoneInvalid, vm.state.value.error)
        assertEquals(Step.Enter, vm.state.value.step)
    }
}
