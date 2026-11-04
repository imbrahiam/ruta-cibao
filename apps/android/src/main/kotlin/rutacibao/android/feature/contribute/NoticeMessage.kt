package rutacibao.android.feature.contribute

import android.content.Context
import rutacibao.android.R
import rutacibao.android.generated.MessageArgs

private val CamelBoundary = Regex("([a-z0-9])([A-Z])")
private val NonAlnum = Regex("[^A-Za-z0-9]+")

/**
 * A server-sent message by catalogue key. The generated [MessageArgs] says which param fills
 * which slot; an unknown key falls back to the generic text, so a newer server never shows a raw key.
 */
@Suppress("DiscouragedApi") // keys arrive from the server, so the string can only be resolved by name
fun noticeMessage(context: Context, key: String, params: Map<String, String>): String {
    val generic = context.getString(R.string.notifications_push_generic)
    val order = MessageArgs.order[key] ?: return generic
    val id = stringId(context, key)
    if (id == 0) return generic
    // A param that starts with "@" is itself a catalogue key (the name of a state), not data.
    val args = order.map { name ->
        val value = params[name].orEmpty()
        if (!value.startsWith("@")) value else stringId(context, value.drop(1)).takeIf { it != 0 }?.let(context::getString).orEmpty()
    }
    return context.getString(id, *args.toTypedArray())
}

@Suppress("DiscouragedApi")
private fun stringId(context: Context, key: String): Int {
    val name = key.replace(CamelBoundary, "$1_$2").replace(NonAlnum, "_").lowercase()
    return context.resources.getIdentifier(name, "string", context.packageName)
}
