package rutacibao.data

import dev.zacsweers.metro.Inject
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import rutacibao.api.generated.CommentsCreateInput
import rutacibao.api.generated.CommentsDeleteInput
import rutacibao.api.generated.CommentsListInput
import rutacibao.api.generated.CommentsListOutput
import rutacibao.api.generated.RutaApi
import rutacibao.api.generated.SafetyReportInput

public typealias Comment = CommentsListOutput.Item

/** What residents say under a consultation, and their experiences of a place. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class CommentsRepository(private val api: RutaApi) {
    public suspend fun list(kind: CommentsListInput.Kind, ref: String, offset: Int, limit: Int): CommentsListOutput =
        api.comments.list(CommentsListInput(kind = kind, ref = ref, offset = offset.toLong(), limit = limit))

    /** `requestId` makes a retried send land once. */
    public suspend fun create(kind: CommentsListInput.Kind, ref: String, body: String, requestId: String): Comment {
        val created = api.comments.create(
            CommentsCreateInput(
                requestId = requestId,
                kind = if (kind == CommentsListInput.Kind.Place) CommentsCreateInput.Kind.Place else CommentsCreateInput.Kind.Consultation,
                ref = ref,
                body = body,
            ),
        )
        return Comment(created.id, created.body, created.author, created.authorImage, created.createdAt, created.isMine)
    }

    public suspend fun delete(id: String) { api.comments.delete(CommentsDeleteInput(commentId = id)) }

    public suspend fun report(id: String, reason: SafetyReportInput.Reason) {
        api.safety.report(
            SafetyReportInput(
                requestId = Uuid.random().toString(),
                target = SafetyReportInput.Target(SafetyReportInput.Target.Kind.Comment, id),
                reason = reason,
                details = null,
            ),
        )
    }

    public fun newRequestId(): String = Uuid.random().toString()
}
