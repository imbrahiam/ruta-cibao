@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package rutacibao.data

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import platform.CoreCrypto.CC_SHA256
import platform.CoreCrypto.CC_SHA256_DIGEST_LENGTH

internal actual fun sha256(bytes: ByteArray): String {
    val digest = UByteArray(CC_SHA256_DIGEST_LENGTH)
    digest.usePinned { output ->
        if (bytes.isEmpty()) CC_SHA256(null, 0u, output.addressOf(0))
        else bytes.usePinned { input -> CC_SHA256(input.addressOf(0), bytes.size.toUInt(), output.addressOf(0)) }
    }
    return digest.joinToString("") { it.toString(16).padStart(2, '0') }
}
