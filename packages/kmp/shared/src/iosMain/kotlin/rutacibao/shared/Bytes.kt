package rutacibao.shared

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.Foundation.create
import platform.posix.memcpy

/** Swift `Data` to a Kotlin `ByteArray` in one copy (for photo uploads). */
@OptIn(ExperimentalForeignApi::class)
public fun byteArrayOf(data: NSData): ByteArray {
    val size = data.length.toInt()
    val bytes = ByteArray(size)
    if (size > 0) bytes.usePinned { memcpy(it.addressOf(0), data.bytes, data.length) }
    return bytes
}

/** Restore draft previews without Swift iterating over boxed Kotlin bytes. */
@OptIn(ExperimentalForeignApi::class)
public fun dataOf(bytes: ByteArray): NSData =
    if (bytes.isEmpty()) NSData() else bytes.usePinned {
        NSData.create(bytes = it.addressOf(0), length = bytes.size.toULong())
    }
