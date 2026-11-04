package rutacibao.presentation.gestion

/** How loudly a card's button speaks. A card has at most one [Primary]; the platform lays the rest out around it. */
public enum class Emphasis { Primary, Secondary }

/**
 * A button on a review card, derived from the state of the item it sits on
 * ([ReviewItem.actions]), never chosen by the screen. The list is in display
 * order: secondaries first, the primary last.
 */
public sealed interface ReviewAction {
    /** Catalogue key of the button label. */
    public val labelKey: String
    public val emphasis: Emphasis

    /** Sends [verdict] for the item; [needsNote] asks for a written reason first. */
    public data class Decide(
        val verdict: Verdict,
        override val labelKey: String,
        override val emphasis: Emphasis,
        val needsNote: Boolean,
    ) : ReviewAction

    /** Opens the consultation thread, where the staff composer is. Nothing is sent from the desk. */
    public data class OpenThread(
        val slug: String,
        override val labelKey: String = "gestion.action.respond",
        override val emphasis: Emphasis = Emphasis.Primary,
    ) : ReviewAction
}

/** Where a text or a case stands in publication review. */
public enum class Publication { Pending, Published, Hidden }
