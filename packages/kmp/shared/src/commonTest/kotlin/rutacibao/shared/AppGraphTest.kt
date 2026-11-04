package rutacibao.shared

import rutacibao.core.AppConfig
import rutacibao.core.SecureStore
import rutacibao.presentation.consultations.ConsultationsUiState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class AppGraphTest {
    private class MemoryStore : SecureStore {
        val values = mutableMapOf<String, String>()
        override fun read(key: String) = values[key]
        override fun write(key: String, value: String) { values[key] = value }
        override fun delete(key: String) { values.remove(key) }
    }

    private val config = AppConfig("http://127.0.0.1:9", "rutacibao-test", AppConfig.Variant.Development, AppConfig.Platform.Ios)

    @Test
    fun graphBuildsEveryViewModel() {
        val graph = createAppGraph(config, MemoryStore())
        // Regression: a factory once called itself instead of its provider.
        val vm = graph.viewModels.consultations()
        assertEquals(ConsultationsUiState.Phase.Loading, vm.state.value.phase)
        assertFalse(graph.session.isSignedIn.value)
    }
}
