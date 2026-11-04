package rutacibao.data

import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import rutacibao.core.SecureStore

/** Chunked Keychain/Keystore storage. The pointer is the commit record, written last. */
@OptIn(ExperimentalUuidApi::class)
internal class OfflineStorage(private val store: SecureStore) {
    fun read(key: String): String? {
        val revision = store.read("$key.current") ?: return null
        val count = store.read("$key.$revision.count")?.toIntOrNull() ?: error("Incomplete offline record")
        require(count in 0..16384)
        return buildString {
            repeat(count) { append(store.read("$key.$revision.$it") ?: error("Incomplete offline record")) }
        }
    }

    fun write(key: String, value: String) {
        val previous = store.read("$key.current")
        val revision = Uuid.random().toString()
        val count = (value.length + CHUNK - 1) / CHUNK
        try {
            repeat(count) { index ->
                val chunk = value.substring(index * CHUNK, minOf(value.length, (index + 1) * CHUNK))
                store.write("$key.$revision.$index", chunk)
                check(store.read("$key.$revision.$index") == chunk) { "Secure storage write failed" }
            }
            store.write("$key.$revision.count", count.toString())
            check(store.read("$key.$revision.count") == count.toString()) { "Secure storage write failed" }
            store.write("$key.current", revision)
            check(store.read("$key.current") == revision) { "Secure storage commit failed" }
        } catch (error: Exception) {
            erase(key, revision, count)
            throw error
        }
        if (previous != null) erase(key, previous)
    }

    fun delete(key: String) {
        val revision = store.read("$key.current") ?: return
        store.delete("$key.current")
        erase(key, revision)
    }

    private fun erase(key: String, revision: String, knownCount: Int? = null) {
        val count = knownCount ?: store.read("$key.$revision.count")?.toIntOrNull() ?: 0
        repeat(count) { store.delete("$key.$revision.$it") }
        store.delete("$key.$revision.count")
    }

    private companion object { const val CHUNK = 16_384 }
}

internal expect fun sha256(bytes: ByteArray): String
