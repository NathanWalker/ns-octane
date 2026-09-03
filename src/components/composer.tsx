import {
  Application,
  Utils,
  isIOS,
  type EventData,
  type ScrollView,
  type TextView,
  type View,
  type ViewBase,
} from "@nativescript/core";
import { InputAccessoryManager } from "@nativescript/input-accessory";
import type { MenuAction } from "@nstudio/nativescript-menu";
import { useEffect, useRef, useState, useSyncExternalStore } from "octane";
import {
  accessory,
  COMPOSER_FONT_SIZE,
  COMPOSER_PILL_BORDER as PILL_BORDER,
  COMPOSER_PILL_HEIGHT as PILL_HEIGHT,
  COMPOSER_ROW_PADDING as CONTAINER_PADDING,
} from "../state/accessory";
import { getState, sendMessage, stopStreaming, subscribe } from "../state/store";
import { tapHaptic } from "../ui/haptics";
import { icons } from "../ui/icons";
import { SfIcon } from "../ui/sf-icon";

// UIKit renders an upward-anchored menu bottom-up; listed reversed so Camera lands on top.
const PLUS_MENU: MenuAction[] = [
  { name: "Think harder", icon: "brain.head.profile", action: () => tapHaptic() },
  { name: "Plugins", icon: "puzzlepiece.extension", action: () => tapHaptic() },
  { name: "Files", icon: "folder", action: () => tapHaptic() },
  { name: "Photos", icon: "photo.on.rectangle", action: () => tapHaptic() },
  { name: "Camera", icon: "camera", action: () => tapHaptic() },
];

export interface ComposerProps {
  row: number;
  /** Set by the chat screen once its ScrollView has loaded. */
  scrollViewRef: { current: ScrollView | null };
  scrollReady: boolean;
}

export function Composer({ row, scrollViewRef, scrollReady }: ComposerProps) {
  const streaming = useSyncExternalStore(subscribe, () => getState().streaming);
  const [draft, setDraft] = useState("");
  const containerRef = useRef<View | null>(null);
  const textViewRef = useRef<TextView | null>(null);
  const managerRef = useRef<InputAccessoryManager | null>(null);

  const trySetup = () => {
    if (managerRef.current) return;
    const container = containerRef.current;
    const textView = textViewRef.current;
    const scrollView = scrollViewRef.current;
    if (!container || !textView || !scrollView) return;
    const page = container.page;
    if (!page) return;

    const manager = new InputAccessoryManager();
    manager.setup({
      page,
      scrollView,
      inputContainer: container,
      textView,
      // Without explicit geometry the plugin falls back to baseHeight 48 and
      // squeezes the pill; see the plugin patch notes.
      baseHeight: PILL_HEIGHT + CONTAINER_PADDING,
      containerPadding: CONTAINER_PADDING,
      collapsedHorizontalInset: 20,
    });
    managerRef.current = manager;
    accessory.current = manager;

    // Center a single line in the pill via CSS padding, never by writing
    // UITextView.textContainerInset natively — core re-maps CSS padding onto
    // the inset on every full style pass and would stomp a raw native write.
    // The insets plus one line must equal the pill's inner height exactly:
    // the plugin grows the bar to the text's fitting height, so any excess
    // makes a single line taller than the pill and pins the text to the top.
    let lineHeight: number;
    if (isIOS) {
      lineHeight = (textView.ios as UITextView).font.lineHeight;
    } else {
      lineHeight = Utils.layout.toDeviceIndependentPixels(
        (textView.android as android.widget.EditText).getLineHeight(),
      );
    }
    const inset = Math.max(0, (PILL_HEIGHT - 2 * PILL_BORDER - lineHeight) / 2);
    textView.style.paddingTop = inset;
    textView.style.paddingBottom = inset;
    textView.style.paddingLeft = 4;
    textView.style.paddingRight = 4;
  };

  useEffect(() => {
    trySetup();
  }, [scrollReady]);

  // On iOS the container lives in the keyboard's own window, which the
  // appearance-change style walk does not reach — ns-dark rules go stale
  // there. Recompute CSS state for the subtree ourselves.
  useEffect(() => {
    const reapply = () => {
      const container = containerRef.current as
        | (View & { _onCssStateChange?: () => void })
        | null;
      if (!container) return;
      const walk = (view: ViewBase & { _onCssStateChange?: () => void }) => {
        view._onCssStateChange?.();
        view.eachChild((child) => {
          walk(child as ViewBase & { _onCssStateChange?: () => void });
          return true;
        });
      };
      setTimeout(() => walk(container), 60);
    };
    Application.on("systemAppearanceChanged", reapply);
    return () => {
      Application.off("systemAppearanceChanged", reapply);
    };
  }, []);

  useEffect(
    () => () => {
      managerRef.current?.cleanup();
      if (accessory.current === managerRef.current) accessory.current = null;
      managerRef.current = null;
    },
    [],
  );

  const send = () => {
    const text = (textViewRef.current?.text ?? draft).trim();
    if (text === "") return;
    tapHaptic();
    if (textViewRef.current) textViewRef.current.text = "";
    setDraft("");
    managerRef.current?.updateAccessoryHeight();
    // The cleared text reaches the native view a beat later; re-measure again
    // so a multi-line pill shrinks back to its base height.
    setTimeout(() => managerRef.current?.updateAccessoryHeight(), 80);
    sendMessage(text);
  };

  const onAction = () => {
    if (streaming) {
      tapHaptic();
      stopStreaming();
    } else if (draft.trim() !== "") {
      send();
    } else {
      tapHaptic();
    }
  };

  const showSend = !streaming && draft.trim() !== "";

  return (
    <gridlayout
      row={row}
      class="composer-row"
      iosOverflowSafeArea={false}
      clipToBounds={false}
      onLoaded={(args: EventData) => {
        containerRef.current = args.object as View;
        trySetup();
      }}
    >
      {/* iosOverflowSafeArea also on the pill: safe-area expansion stretches a
          background whose edge lands on the boundary (the docked resting
          state), smearing the border past the rounded corners. */}
      <gridlayout
        columns="auto, *, auto, auto"
        class="composer-pill"
        minHeight={PILL_HEIGHT}
        iosOverflowSafeArea={false}
      >
        <SfIcon
          col={0}
          name="plus"
          size={19}
          class="composer-icon"
          fa={icons.plus}
          width={44}
          height={PILL_HEIGHT}
          verticalAlignment="bottom"
          menu={PLUS_MENU}
        />
        <textview
          col={1}
          ref={textViewRef}
          hint="Ask anything"
          minHeight={PILL_HEIGHT}
          fontSize={COMPOSER_FONT_SIZE}
          class="composer-input"
          onLoaded={(args: EventData) => {
            textViewRef.current = args.object as TextView;
            trySetup();
          }}
          onChange={(args) => {
            setDraft((args.object as TextView).text ?? "");
            managerRef.current?.updateAccessoryHeight();
          }}
        />
        <SfIcon
          col={2}
          name="mic"
          size={18}
          class="composer-icon"
          fa={icons.mic}
          width={36}
          height={PILL_HEIGHT}
          verticalAlignment="bottom"
          visibility={showSend ? "collapse" : "visible"}
        />
        {/* All action states stay mounted; visibility swaps them. */}
        <SfIcon
          col={3}
          name="stop.fill"
          size={12}
          class="composer-action composer-action-voice"
          fa={"■"}
          visibility={streaming ? "visible" : "collapse"}
          onTap={onAction}
        />
        <SfIcon
          col={3}
          name="arrow.up"
          size={15}
          weight="semibold"
          class="composer-action composer-action-send"
          fa={icons.arrowUp}
          visibility={!streaming && showSend ? "visible" : "collapse"}
          onTap={onAction}
        />
        <SfIcon
          col={3}
          name="waveform"
          size={15}
          weight="medium"
          class="composer-action composer-action-voice"
          fa={icons.mic}
          visibility={!streaming && !showSend ? "visible" : "collapse"}
          onTap={onAction}
        />
      </gridlayout>
    </gridlayout>
  );
}
