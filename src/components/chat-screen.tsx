import {
  Screen,
  Utils,
  isAndroid,
  isIOS,
  type EventData,
  type ScrollEventData,
  type ScrollView,
  type StackLayout,
  type View,
} from "@nativescript/core";
import type { MenuAction } from "@nstudio/nativescript-menu";
import { useEffect, useRef, useState, useSyncExternalStore } from "octane";
import { dismissKeyboard, dockedComposerHeight } from "../state/accessory";
import {
  activeConversation,
  deleteConversation,
  getState,
  newChat,
  sendMessage,
  subscribe,
} from "../state/store";
import { safeAreaInsets } from "../ui/safe-area";
import { selectHaptic, tapHaptic } from "../ui/haptics";
import { icons } from "../ui/icons";
import { slideWithKeyboard } from "../ui/keyboard";
import { SfIcon } from "../ui/sf-icon";
import { shareConversation } from "../ui/share";
import { Streamdown } from "../ui/streamdown";
import { Composer } from "./composer";

const TOP_BAR_HEIGHT = 56;

/**
 * The offset that shows the end of the content. `scrollableHeight` ignores the
 * bottom content inset the accessory plugin keeps for the composer (and the
 * keyboard), so scrolling there would leave the newest lines behind the bar;
 * and core pads `contentSize` up to the viewport, which would read as a full
 * screen of content when there is less. The content's own frame is the truth.
 */
function endOffset(scrollView: ScrollView): number {
  if (!isIOS) return scrollView.scrollableHeight;
  const native = scrollView.ios as UIScrollView;
  const content = scrollView.content as View | undefined;
  if (!content?.ios) return scrollView.scrollableHeight;
  // Core stretches the content child to the viewport, so its frame is not
  // its extent; the measured height is.
  const contentBottom =
    (content.ios as UIView).frame.origin.y +
    Utils.layout.toDeviceIndependentPixels(content.getMeasuredHeight()) +
    native.safeAreaInsets.bottom;
  return Math.max(0, contentBottom + native.contentInset.bottom - native.bounds.size.height);
}

interface TopBarProps {
  chatMenu: MenuAction[] | null;
  onMenu: () => void;
  onNewChat: () => void;
}

function TopBar({ chatMenu, onMenu, onNewChat }: TopBarProps) {
  const hasChat = chatMenu !== null;
  const androidTop = isAndroid ? safeAreaInsets().top : 0;
  return (
    <gridlayout
      row={0}
      rows="auto"
      columns="auto, *, auto"
      verticalAlignment="top"
      padding="6 14 14 14"
      paddingTop={6 + androidTop}
      clipToBounds={false}
    >
      <SfIcon
        col={0}
        name="line.3.horizontal"
        size={17}
        weight="medium"
        class="icon-circle"
        fa={icons.menu}
        onTap={onMenu}
      />
      {!hasChat ? (
        <stacklayout col={1} orientation="horizontal" horizontalAlignment="center" clipToBounds={false}>
          {/* Star row: an auto row in this fixed-height pill would pin the
              labels to the top instead of centering them. */}
          <gridlayout columns="auto, auto" class="upgrade-pill">
            <SfIcon
              col={0}
              name="sparkle"
              size={15}
              weight="semibold"
              class="upgrade-text"
              width={20}
              height={44}
              marginRight={7}
              fa={icons.sparkle}
            />
            <label col={1} text="Upgrade" class="upgrade-text" />
          </gridlayout>
        </stacklayout>
      ) : null}
      {hasChat ? (
        <gridlayout col={2} rows="auto" columns="auto, auto" class="bar-pill" verticalAlignment="top">
          <SfIcon
            col={0}
            name="square.and.pencil"
            size={17}
            weight="medium"
            class="bar-pill-btn"
            fa={icons.compose}
            faClass="far"
            onTap={onNewChat}
          />
          <SfIcon
            col={1}
            name="ellipsis"
            size={17}
            weight="medium"
            class="bar-pill-btn"
            fa={icons.ellipsis}
            menu={chatMenu ?? []}
          />
        </gridlayout>
      ) : (
        <SfIcon
          col={2}
          name="bubble"
          size={17}
          weight="medium"
          class="icon-circle"
          fa={icons.newChatBubble}
          faClass="far"
        />
      )}
    </gridlayout>
  );
}

const SUGGESTIONS = [
  { sf: "photo", fa: icons.image, faClass: "far", text: "Create an image or sticker" },
  { sf: "pencil", fa: icons.pencil, faClass: "fas", text: "Write or edit" },
  { sf: "globe", fa: icons.globe, faClass: "fas", text: "Search the web" },
];

/** Space between the last suggestion row and the composer bar. */
const SUGGESTION_GAP = 50;
/** Clearance between the scroll-to-bottom button and the composer bar. */
const FAB_GAP = 10;

interface EmptyStateProps {
  suggestRef: { current: StackLayout | null };
  /** Rows sit this far above the docked bar (see ChatScreen). */
  marginBottom: number;
  /** Keyboard lift in effect when the rows mount, so they appear in place. */
  lift: number;
}

function EmptyState({ suggestRef, marginBottom, lift }: EmptyStateProps) {
  return (
    <stacklayout
      row={0}
      ref={suggestRef}
      verticalAlignment="bottom"
      class="px-5"
      marginBottom={marginBottom}
      translateY={-lift}
      clipToBounds={false}
    >
      {SUGGESTIONS.map((suggestion) => (
        // rows="auto" matters: a grid's implicit row is star, and a vertical
        // StackLayout measures children against its remaining bounded height,
        // so a spec-less grid would swallow it all and starve later siblings.
        <gridlayout
          key={suggestion.text}
          rows="auto"
          columns="auto, *"
          class="py-2.5"
          clipToBounds={false}
          onTap={() => {
            tapHaptic();
            sendMessage(suggestion.text);
          }}
        >
          <SfIcon
            col={0}
            name={suggestion.sf}
            size={16}
            class="suggest-icon"
            fa={suggestion.fa}
            faClass={suggestion.faClass}
          />
          <label col={1} text={suggestion.text} class="suggest-text" />
        </gridlayout>
      ))}
    </stacklayout>
  );
}

export interface ChatScreenProps {
  onMenu: () => void;
}

export function ChatScreen({ onMenu }: ChatScreenProps) {
  const state = useSyncExternalStore(subscribe, getState);
  const conversation = activeConversation(state);

  const chatMenu: MenuAction[] | null = conversation
    ? [
        {
          name: "Share",
          icon: "square.and.arrow.up",
          action: () => {
            tapHaptic();
            shareConversation(conversation);
          },
        },
        { name: "Pin", icon: "pin", action: () => tapHaptic() },
        { name: "Archive", icon: "archivebox", action: () => tapHaptic() },
        {
          name: "Delete",
          icon: "trash",
          destructive: true,
          action: () => {
            tapHaptic();
            deleteConversation(conversation.id);
          },
        },
      ]
    : null;
  const lastMessage = conversation?.messages[conversation.messages.length - 1];

  const scrollRef = useRef<ScrollView | null>(null);
  const suggestRef = useRef<StackLayout | null>(null);
  const followRef = useRef(true);
  const [scrollReady, setScrollReady] = useState(false);
  const [fabVisible, setFabVisible] = useState(false);

  const scrollToEnd = (animated = true) => {
    setTimeout(() => {
      const scrollView = scrollRef.current;
      if (!scrollView) return;
      const end = endOffset(scrollView);
      if (end > 0) scrollView.scrollToVerticalOffset(end, animated);
    }, 60);
  };

  // Keep the newest streamed tokens on screen unless the reader scrolled up.
  useEffect(() => {
    if (followRef.current) scrollToEnd();
  }, [conversation?.messages.length, lastMessage?.text.length]);

  useEffect(() => {
    followRef.current = true;
    setFabVisible(false);
    scrollToEnd(false);
  }, [conversation?.id]);

  // On iOS the composer is reparented into the keyboard's accessory window, so
  // grid row 1 reserves no height for it: the rows clear the docked bar (which
  // extends below the safe area) through their margin, and only the keyboard's
  // own height moves them, in step with its animation.
  const suggestMargin = isIOS
    ? SUGGESTION_GAP + dockedComposerHeight() - safeAreaInsets().bottom
    : 10;
  // Same reasoning for the scroll-to-bottom button: it lives in the scroll
  // row, whose bottom edge is the composer on Android but the safe-area line
  // on iOS, where the bar floats in the keyboard window.
  const fabMargin = isIOS ? FAB_GAP + dockedComposerHeight() - safeAreaInsets().bottom : FAB_GAP;
  // The root page skips the system-bar insets on Android (see index.ts); the
  // chrome pads itself so the canvas and the scrolled content run under the
  // bars while the top bar and the docked composer stay clear of them. IME
  // insets remain the accessory plugin's business.
  const androidInsets = isAndroid ? safeAreaInsets() : { top: 0, bottom: 0 };
  const liftRef = useRef(0);
  useEffect(() => {
    if (!isIOS) return;
    const center = NSNotificationCenter.defaultCenter;
    const observer = center.addObserverForNameObjectQueueUsingBlock(
      UIKeyboardWillChangeFrameNotification,
      null,
      NSOperationQueue.mainQueue,
      (notification) => {
        const info = notification.userInfo;
        const frame = (info.objectForKey(UIKeyboardFrameEndUserInfoKey) as NSValue).CGRectValue;
        // While the keyboard window is torn down iOS posts an empty end frame
        // at the origin; it carries no position, so it must not read as a
        // keyboard covering the whole screen.
        if (frame.size.height === 0) return;
        // The reported frame includes the docked bar. Anything not taller than
        // the bar is the bar alone, a transient frame mid responder hand-off, or
        // the bar suspended — the rows stay put for all of them.
        const overlap = Screen.mainScreen.heightDIPs - frame.origin.y;
        const lift = Math.max(0, overlap - dockedComposerHeight());
        liftRef.current = lift;
        const view = suggestRef.current;
        if (view) slideWithKeyboard(view, -lift, info);
      },
    );
    return () => center.removeObserver(observer);
  }, []);

  const onScroll = (args: EventData) => {
    const scrollView = scrollRef.current;
    if (!scrollView) return;
    const fromBottom = endOffset(scrollView) - (args as ScrollEventData).scrollY;
    const nearBottom = fromBottom < 160;
    followRef.current = nearBottom;
    setFabVisible(!nearBottom && conversation !== null);
  };

  return (
    <gridlayout
      rows="*, auto"
      class="screen-canvas"
      androidOverflowEdge="dont-apply"
      paddingBottom={androidInsets.bottom}
      clipToBounds={false}
    >
      {/* The viewport runs to the physical edges so content scrolls under the
          status bar and the composer (a ScrollView does not overflow the safe
          area on its own, unlike layouts); core lays the content out inside
          the safe-area insets, and the fades supply the rest of the clearance. */}
      <scrollview
        row={0}
        iosOverflowSafeArea={true}
        ignoreTouchAnimation={true}
        onLoaded={(args: EventData) => {
          scrollRef.current = args.object as ScrollView;
          setScrollReady(true);
        }}
        onScroll={onScroll}
        onTap={dismissKeyboard}
      >
        {/* The viewport owns the safe-area handling (it offsets the content by
            the insets and adds them to contentSize); the content must neither
            expand into the safe area nor be shrunk by it, which core would do
            from insets that change as it scrolls under the bars. */}
        <stacklayout class="px-4" paddingTop={TOP_BAR_HEIGHT + androidInsets.top} iosIgnoreSafeArea={true}>
          {conversation?.messages.map((message) =>
            message.role === "user" ? (
              <label
                key={message.id}
                text={message.text}
                textWrap={true}
                class="bubble-user"
              />
            ) : (
              <Streamdown
                key={message.id}
                content={message.text}
                config={{ mode: message.streaming ? "streaming" : "static" }}
              />
            ),
          )}
        </stacklayout>
      </scrollview>

      {conversation === null ? (
        <EmptyState suggestRef={suggestRef} marginBottom={suggestMargin} lift={liftRef.current} />
      ) : null}

      {state.streaming ? (
        <stacklayout
          row={0}
          class="stream-fade"
          verticalAlignment="bottom"
          isUserInteractionEnabled={false}
        />
      ) : null}

      {/* Painted separately, behind the bar: a child's box-shadow composites
          under its parent's background, so a bar-owned fade would hide the
          button shadows. Laid out inside the safe area and then expanded to
          the physical top, so its height is the bar band only and its bottom
          edge lands exactly where the content's top padding ends: nothing is
          washed out until content scrolls up into it. */}
      <stacklayout
        row={0}
        class="top-bar-fade"
        verticalAlignment="top"
        height={TOP_BAR_HEIGHT + androidInsets.top}
        iosOverflowSafeArea={true}
        isUserInteractionEnabled={false}
      />

      {fabVisible ? (
        <SfIcon
          row={0}
          name="arrow.down"
          size={14}
          weight="medium"
          class="scroll-down-fab"
          fa={icons.arrowDown}
          verticalAlignment="bottom"
          horizontalAlignment="center"
          marginBottom={fabMargin}
          onTap={() => {
            selectHaptic();
            followRef.current = true;
            setFabVisible(false);
            scrollToEnd();
          }}
        />
      ) : null}

      <TopBar
        chatMenu={chatMenu}
        onMenu={onMenu}
        onNewChat={() => {
          tapHaptic();
          newChat();
        }}
      />

      <Composer row={1} scrollViewRef={scrollRef} scrollReady={scrollReady} />
    </gridlayout>
  );
}
