package rutacibao.android.platform

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.security.GeneralSecurityException
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import rutacibao.core.SecureStore

/**
 * AES-GCM with a non-exportable Android Keystore key; only ciphertext touches
 * disk. Backups are off (manifest), so a restored device starts signed out,
 * which matches the iOS "this device only" Keychain class.
 */
class KeystoreSecureStore(context: Context) : SecureStore {
    private val prefs = context.getSharedPreferences("rutacibao.secure", Context.MODE_PRIVATE)

    /**
     * Large values (the offline copy arrives as ~190 chunks of 16 KB) get a file each.
     * SharedPreferences rewrites its whole XML on every commit, so keeping megabytes in it
     * made one download take over half a minute and slowed every later read of the session.
     */
    private val files = File(context.noBackupFilesDir, "secure").apply { mkdirs() }
    private val cachedKey by lazy(::loadKey)

    override fun read(key: String): String? {
        val stored = prefs.getString(key, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: file(key).takeIf(File::exists)?.readBytes()
            ?: return null
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, cachedKey, GCMParameterSpec(128, stored, 0, IV_SIZE))
            String(cipher.doFinal(stored, IV_SIZE, stored.size - IV_SIZE), Charsets.UTF_8)
        } catch (unrecoverable: GeneralSecurityException) {
            // Only a value that can never decrypt is dropped: a bad tag, or a key the
            // system invalidated. A transient Keystore failure must not sign the person
            // out or delete a chunk of their offline queue.
            if (unrecoverable is AEADBadTagException || unrecoverable is KeyPermanentlyInvalidatedException) delete(key)
            null
        } catch (_: RuntimeException) {
            null
        }
    }

    override fun write(key: String, value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, cachedKey)
        val payload = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        if (value.length >= LARGE) {
            // Whole or not at all: write beside the target, then rename over it.
            val target = file(key)
            val pending = File(files, target.name + ".tmp")
            pending.writeBytes(payload)
            check(pending.renameTo(target)) { "Secure storage write failed" }
            if (prefs.contains(key)) prefs.edit().remove(key).commit()
        } else {
            check(prefs.edit().putString(key, Base64.encodeToString(payload, Base64.NO_WRAP)).commit()) { "Secure storage write failed" }
            file(key).delete()
        }
    }

    override fun delete(key: String) {
        if (prefs.contains(key)) check(prefs.edit().remove(key).commit()) { "Secure storage delete failed" }
        file(key).delete()
    }

    /** Keys are ours (dotted identifiers); anything else is flattened so it cannot leave the folder. */
    private fun file(key: String) = File(files, key.replace(Regex("[^A-Za-z0-9._-]"), "_"))

    private fun loadKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).apply {
            init(
                KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build(),
            )
        }.generateKey()
    }

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "rutacibao.secure.v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE = 12
        const val LARGE = 4_096
    }
}
