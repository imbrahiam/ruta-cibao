"use client";

import {
  ArrowUp,
  Compass,
  MapPin,
  MessageCircleQuestionMark,
  Search,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ImageViewer, type ViewerPhoto } from "@/components/ui/image-viewer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { uuid } from "@/lib/uuid";

/**
 * Asking the map a question.
 *
 * Retrieval-grounded on purpose: every place named in an answer is a row that
 * came back from the database, and the cards under the answer are those same
 * rows. There is no path here where the assistant describes a clinic nobody
 * mapped — on a civic map that is not a quirk, it is a false address handed to
 * somebody looking for help.
 *
 * The cards arrive before the sentence does. They are the useful half, they are
 * ready first, and on a rural connection the person gets them even if the prose
 * never finishes streaming.
 */
type Place = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  municipalityName: string;
  photo: string | null;
};

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  places?: Place[];
  failed?: boolean;
};

/** Openers that show what the thing is for without a paragraph explaining it. */
const SUGGESTION_KEYS = ["water", "health", "eat", "nature"] as const;

function PlaceCard({
  place,
  onOpen,
  onPreview,
}: {
  place: Place;
  onOpen?: () => void;
  onPreview: (photo: ViewerPhoto, title: string) => void;
}) {
  const t = useTranslations("assistant");
  const Icon = categoryIcon(place.categoryIcon);
  const photo = place.photo;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      {photo ? (
        <button
          type="button"
          onClick={() =>
            onPreview(
              { src: photo, alt: t("photoAlt", { name: place.name }) },
              place.name,
            )
          }
          className="relative size-14 shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src={photo}
            alt={t("photoAlt", { name: place.name })}
            fill
            sizes="3.5rem"
            className="object-cover"
            unoptimized
          />
        </button>
      ) : (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${place.categoryColor}1a` }}
        >
          <Icon className="size-4" style={{ color: place.categoryColor }} />
        </span>
      )}
      <Link
        href={`/mapa?lugar=${place.slug}`}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-sm">
            {place.name}
          </span>
          <span className="block truncate text-muted-foreground text-xs">
            {place.categoryName} · {place.municipalityName}
          </span>
        </span>
        <Compass
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </div>
  );
}

export type AssistantChatController = {
  turns: Turn[];
  draft: string;
  thinking: boolean;
  setDraft: (value: string) => void;
  ask: (question: string) => void;
  /** Ends the conversation so a new question starts clean. */
  clear: () => void;
};

/**
 * The conversation, owned outside the drawer so it survives closing and
 * reopening it. One controller per map screen; the phone drawer and the
 * desktop sheet render from the same one, so the history follows the person
 * rather than the container.
 */
export function useAssistantChat(): AssistantChatController {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 2 || thinking) return;

    // The last few turns only. The assistant answers from what the map holds,
    // not from a long memory of the conversation, and sending everything would
    // spend a citizen's data on context that changes nothing.
    const history = turns
      .slice(-4)
      .map((turn) => ({ role: turn.role, content: turn.text }))
      .filter((turn) => turn.content.length > 0);

    const answerId = uuid();
    setTurns((current) => [
      ...current,
      { id: uuid(), role: "user", text: trimmed },
      { id: answerId, role: "assistant", text: "" },
    ]);
    setDraft("");
    setThinking(true);

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    function patch(update: (turn: Turn) => Turn) {
      setTurns((current) =>
        current.map((turn) => (turn.id === answerId ? update(turn) : turn)),
      );
    }

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error("assistant failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Server-sent events are separated by a blank line; anything after the
        // last one is a partial frame and stays in the buffer.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const name = frame.match(/^event: (.+)$/m)?.[1];
          const raw = frame.match(/^data: (.*)$/m)?.[1];
          if (!name || raw === undefined) continue;

          const data = JSON.parse(raw);
          if (name === "places") {
            patch((turn) => ({ ...turn, places: data as Place[] }));
          } else if (name === "text") {
            patch((turn) => ({ ...turn, text: turn.text + String(data) }));
          } else if (name === "error") {
            patch((turn) => ({ ...turn, failed: true }));
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        patch((turn) => ({ ...turn, failed: true }));
      }
    } finally {
      setThinking(false);
    }
  }

  function clear() {
    // Stopping first: the in-flight stream keeps patching an answer id that
    // no longer exists, and those patches are no-ops against empty turns.
    abort.current?.abort();
    abort.current = null;
    setThinking(false);
    setDraft("");
    setTurns([]);
  }

  return { turns, draft, thinking, setDraft, ask, clear };
}

export function AssistantChat({
  chat,
  onNavigate,
}: {
  chat: AssistantChatController;
  onNavigate?: () => void;
}) {
  const t = useTranslations("assistant");
  const tv = useTranslations("viewer");
  const { turns, draft, thinking, setDraft, ask } = chat;
  const empty = turns.length === 0;
  // The photo opened in the viewer, if any. One viewer per chat: a card hands
  // over its single photo, and the viewer owns the index from there.
  const [preview, setPreview] = useState<{
    title: string;
    photos: ViewerPhoto[];
    index: number;
  } | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Root reads the scroller context — without the provider above it,
          every child throws "must be used within a MessageScroller".
          autoScroll pins the viewport to new words while they stream in and
          yields the moment the reader scrolls up. */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport className="px-4">
            <MessageScrollerContent className="py-4">
              {empty && (
                <MessageScrollerItem>
                  <Empty className="py-6">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageCircleQuestionMark />
                      </EmptyMedia>
                      <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                      <EmptyDescription>{t("emptyHint")}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>

                  <div className="mt-2 flex flex-col gap-2">
                    {SUGGESTION_KEYS.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal py-2.5 text-left text-[15px] leading-snug"
                        onClick={() => void ask(t(`suggestions.${key}`))}
                      >
                        <Search
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        {t(`suggestions.${key}`)}
                      </Button>
                    ))}
                  </div>
                </MessageScrollerItem>
              )}

              {turns.map((turn, index) => (
                <MessageScrollerItem
                  key={turn.id}
                  messageId={turn.id}
                  scrollAnchor={index === turns.length - 1}
                >
                  <Message align={turn.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      {turn.role === "user" ? (
                        <Bubble align="end">
                          <BubbleContent>{turn.text}</BubbleContent>
                        </Bubble>
                      ) : (
                        <>
                          {/* One live status line, shimmering, while the places
                            are still being looked up. It is replaced in place
                            rather than stacking above the answer. */}
                          {turn.text.length === 0 &&
                            !turn.failed &&
                            !turn.places && (
                              <Marker role="status">
                                <MarkerIcon>
                                  <Spinner />
                                </MarkerIcon>
                                <MarkerContent className="shimmer">
                                  {t("searching")}
                                </MarkerContent>
                              </Marker>
                            )}

                          {turn.places && turn.places.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {turn.places.map((place) => (
                                <PlaceCard
                                  key={place.id}
                                  place={place}
                                  onOpen={onNavigate}
                                  onPreview={(photo, title) =>
                                    setPreview({
                                      title,
                                      photos: [photo],
                                      index: 0,
                                    })
                                  }
                                />
                              ))}
                            </div>
                          )}

                          {turn.text.length === 0 &&
                            turn.places &&
                            !turn.failed && (
                              <Marker role="status">
                                <MarkerContent className="shimmer">
                                  {t("writing")}
                                </MarkerContent>
                              </Marker>
                            )}

                          {turn.text.length > 0 && (
                            <Bubble variant="ghost" align="start">
                              <BubbleContent className="text-pretty text-[15px] leading-relaxed">
                                {turn.text}
                              </BubbleContent>
                            </Bubble>
                          )}

                          {turn.failed && (
                            <Marker role="alert" className="text-destructive">
                              <MarkerIcon>
                                <TriangleAlert />
                              </MarkerIcon>
                              <MarkerContent>{t("failed")}</MarkerContent>
                            </Marker>
                          )}
                        </>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>

          <MessageScrollerButton className="bottom-3" />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="shrink-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            void ask(draft);
          }}
        >
          {/* Solid and fully opaque even while the send button is disabled:
              the group dims itself with `has-disabled` when anything inside
              is, and an empty draft keeps send disabled — so without the
              override the box reads as switched off from the first sight. */}
          <InputGroup className="bg-background shadow-sm has-disabled:bg-background has-disabled:opacity-100 dark:has-disabled:bg-input/30">
            <InputGroupTextarea
              value={draft}
              onChange={(changeEvent) => setDraft(changeEvent.target.value)}
              onKeyDown={(keyEvent) => {
                // Enter sends, Shift+Enter breaks the line — the convention
                // every messaging app on the phone already taught.
                if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
                  keyEvent.preventDefault();
                  void ask(draft);
                }
              }}
              placeholder={t("placeholder")}
              rows={1}
              maxLength={400}
              // One line at rest, growing with the text up to a cap — the box
              // never eats the conversation above it.
              className="field-sizing-content max-h-32 min-h-10 text-base md:text-sm"
            />
            {/* One action below the text, not two. The "+" that used to sit
                opposite it meant "new conversation", which is not what a plus
                in a composer says to anybody — every other chat app has taught
                that it attaches something. It moved to the header, where
                starting over is conventionally offered and where it cannot be
                mistaken for part of the message being written.
                
                44 px on a touch screen, because the coarse-pointer rule sets a
                44 px floor and anything narrower comes out as a crushed oval.
                With a mouse there is no such floor and 36 px is the size this
                button actually wants to be. */}
            <InputGroupAddon align="block-end" className="justify-end">
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="default"
                className="size-11 rounded-full pointer-fine:size-9"
                aria-label={t("send")}
                disabled={thinking || draft.trim().length < 2}
              >
                {thinking ? (
                  <Spinner className="size-5 pointer-fine:size-4" />
                ) : (
                  <ArrowUp className="size-5 pointer-fine:size-4" aria-hidden />
                )}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          {t("grounding")}
        </p>
      </div>

      {preview && (
        <ImageViewer
          photos={preview.photos}
          index={preview.index}
          onIndexChange={(index) => setPreview({ ...preview, index })}
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          title={preview.title}
          counter={tv("counter", {
            current: preview.index + 1,
            total: preview.photos.length,
          })}
          labels={{
            close: tv("close"),
            previous: tv("previous"),
            next: tv("next"),
          }}
        />
      )}
    </div>
  );
}
