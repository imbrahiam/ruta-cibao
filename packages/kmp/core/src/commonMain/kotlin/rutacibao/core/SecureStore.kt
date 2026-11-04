package rutacibao.core

/**
 * Small secrets (the session cookie, the offline database key). Implemented
 * natively by each app: Keychain on iOS (after first unlock, this device
 * only), Keystore-backed encryption on Android. Calls may block briefly, so
 * keep them off the main thread.
 */
public interface SecureStore {
    public fun read(key: String): String?
    public fun write(key: String, value: String)
    public fun delete(key: String)
}
