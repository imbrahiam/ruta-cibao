/**
 * Handing a link to someone else, on the phones people actually have.
 *
 * Both of the browser APIs for this are gated on a secure context, and the app
 * is opened over plain HTTP more often than it looks — a phone on the office
 * LAN pointed at a dev machine, a municipal kiosk on an internal address. In
 * those tabs `navigator.share` and `navigator.clipboard` are not merely
 * refused, they are `undefined`, so reaching straight for `.writeText` threw
 * and the share menu did nothing at all.
 *
 * So: the share sheet where it exists, the async clipboard where it does not,
 * and the old `execCommand` copy — which needs no secure context — where
 * neither is there. The caller gets back what actually happened and says so.
 */
export type ShareOutcome = "shared" | "copied" | "failed";

/**
 * Copies through a throwaway textarea, the way everyone did before the
 * clipboard API. Deprecated, and the only thing that works over HTTP.
 */
function copyWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  // Off-screen but still focusable: `display: none` cannot be selected, and a
  // visible field would scroll the page under the person's finger.
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.opacity = "0";
  document.body.append(field);

  // Whatever the person had selected before is put back afterwards.
  const selection = document.getSelection();
  const previous =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  field.select();
  // iOS ignores `select()` on a read-only field; the explicit range is what
  // makes the copy land there.
  field.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  field.remove();
  if (selection && previous) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }

  return copied;
}

export async function shareUrl({
  url,
  title,
}: {
  url: string;
  title?: string;
}): Promise<ShareOutcome> {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share(title ? { title, url } : { url });
      return "shared";
    } catch (error) {
      // Dismissing the share sheet is a decision, not a failure: copying the
      // link behind their back would be answering a question they closed.
      if (error instanceof Error && error.name === "AbortError") {
        return "shared";
      }
      // Anything else — the sheet refused the payload, or the gesture expired
      // — falls through to the clipboard.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      // Denied permission or an insecure context that exposes the object
      // anyway. The selection copy below still has a chance.
    }
  }

  return copyWithSelection(url) ? "copied" : "failed";
}
