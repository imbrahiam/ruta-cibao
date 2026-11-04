package rutacibao.android.platform

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.android.BuildConfig
import rutacibao.android.MainActivity
import rutacibao.android.R
import rutacibao.android.RutaApplication
import rutacibao.data.AppTarget
import rutacibao.data.PushRepository

/** Firebase is optional at build time; absent config/Play services never breaks the inbox. */
object PushNotifications {
    enum class Capability { Available, MissingConfiguration, PlayServicesUnavailable }
    var capability: Capability = Capability.MissingConfiguration
        private set
    private val received = MutableStateFlow(0L)
    val revision = received.asStateFlow()
    private var messaging: FirebaseMessaging? = null
    const val CHANNEL = "notifications"

    fun initialize(context: Context) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, context.getString(R.string.notifications_title), NotificationManager.IMPORTANCE_DEFAULT),
        )
        val config = listOf(BuildConfig.FIREBASE_APPLICATION_ID, BuildConfig.FIREBASE_API_KEY, BuildConfig.FIREBASE_PROJECT_ID, BuildConfig.FIREBASE_SENDER_ID)
        if (config.any(String::isBlank)) return
        if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) != ConnectionResult.SUCCESS) {
            capability = Capability.PlayServicesUnavailable
            return
        }
        runCatching {
            if (FirebaseApp.getApps(context).none { it.name == FirebaseApp.DEFAULT_APP_NAME }) {
                FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APPLICATION_ID)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .build())
            }
            messaging = FirebaseMessaging.getInstance()
            capability = Capability.Available
        }
    }

    fun permissionGranted(context: Context): Boolean =
        (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
            NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE

    fun sync(application: RutaApplication) {
        if (!permissionGranted(application)) {
            messaging?.isAutoInitEnabled = false
            application.applicationScope.launch { application.graph.push.unregister() }
            return
        }
        val client = messaging ?: return
        client.isAutoInitEnabled = true
        client.token.addOnSuccessListener { token ->
            application.applicationScope.launch { application.graph.push.register(PushRepository.Platform.Android, token) }
        }
    }

    fun refreshInbox() { received.update { it + 1 } }

    /** Also used by the debug-only synthetic-notification hook; no provider needed. [permissionGranted] guards the post. */
    @android.annotation.SuppressLint("MissingPermission")
    fun show(context: Context, notificationId: String, href: String?) {
        refreshInbox()
        if (!permissionGranted(context)) return
        val target = href?.takeIf { AppTarget.parse(it, BuildConfig.API_ORIGIN, BuildConfig.APP_SCHEME) != null } ?: "/contributions"
        val intent = Intent(context, MainActivity::class.java)
            .setAction("rutacibao.notification.$notificationId")
            .putExtra("href", target)
            .putExtra("notificationId", notificationId)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(context, notificationId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.notifications_title))
            .setContentText(context.getString(R.string.notifications_push_generic))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(notificationId, 0, notification)
    }
}

class RutaMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val app = application as RutaApplication
        if (!PushNotifications.permissionGranted(app)) return
        app.applicationScope.launch { app.graph.push.register(PushRepository.Platform.Android, token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val id = message.data["notificationId"] ?: message.messageId ?: return
        PushNotifications.show(this, id, message.data["href"])
    }

    override fun onDeletedMessages() { PushNotifications.refreshInbox() }
}
