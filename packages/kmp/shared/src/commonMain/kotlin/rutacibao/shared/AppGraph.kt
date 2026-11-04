package rutacibao.shared

import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.DependencyGraph
import dev.zacsweers.metro.Provides
import dev.zacsweers.metro.SingleIn
import dev.zacsweers.metro.createGraphFactory
import rutacibao.api.generated.RutaApi
import rutacibao.core.AppConfig
import rutacibao.core.SecureStore
import rutacibao.data.PushRepository
import rutacibao.data.Session
import rutacibao.data.StaffRepository
import rutacibao.data.StaffSource
import rutacibao.data.createHttpClient
import rutacibao.data.createRutaApi
import io.ktor.client.HttpClient
import rutacibao.presentation.ViewModels

/** The app's object graph, validated at compile time by Metro. */
@DependencyGraph(AppScope::class)
public interface AppGraph {
    public val session: Session
    public val viewModels: ViewModels
    public val push: PushRepository
    public val offline: rutacibao.data.OfflineRepository

    @Provides
    @SingleIn(AppScope::class)
    public fun provideHttpClient(config: AppConfig, session: Session): HttpClient = createHttpClient(config, session)

    @Provides
    @SingleIn(AppScope::class)
    public fun provideRutaApi(client: HttpClient, config: AppConfig): RutaApi = createRutaApi(client, config)

    @Provides
    public fun provideStaffSource(repository: StaffRepository): StaffSource = repository

    @DependencyGraph.Factory
    public fun interface Factory {
        public fun create(
            @Provides config: AppConfig,
            @Provides secureStore: SecureStore,
        ): AppGraph
    }
}

/** Entry point for both apps: build the graph once, at launch. */
public fun createAppGraph(config: AppConfig, secureStore: SecureStore): AppGraph =
    createGraphFactory<AppGraph.Factory>().create(config, secureStore)
