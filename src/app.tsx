import { Color, Screen, type GridLayout } from "@nativescript/core";
import type {
  AnimationFunctionType,
  Drawer as UiDrawer,
  TranslationFunctionType,
} from "@nativescript-community/ui-drawer";
import { useRef } from "octane";
import { ChatScreen } from "./components/chat-screen";
import { DrawerPanel } from "./components/drawer";
import { openSettings } from "./components/settings";
import { dismissKeyboard, setComposerPushed, translateComposer } from "./state/accessory";
import { drawerHaptic, tapHaptic } from "./ui/haptics";

// ChatGPT leaves the pushed-aside content undimmed — the seam reads as a
// shadow, not a scrim. Near-zero alpha keeps the backdrop tappable (the
// drawer hides it entirely at opacity 0).
const BACKDROP = new Color("rgba(0, 0, 0, 0.02)");
const OPEN_CORNER_RADIUS = 40;

export function App() {
  const drawerRef = useRef<UiDrawer | null>(null);
  const mainRef = useRef<GridLayout | null>(null);
  const drawerWidth = Math.min(320, Math.round(Screen.mainScreen.widthDIPs * 0.75));

  // ChatGPT choreography: main content pushes right by the full reveal, the
  // panel rides in with a slight parallax, the backdrop dims what remains of
  // the main content, and the docked composer rides along with the content
  // (it lives in the keyboard's window, so nothing else would move it). Runs
  // per-frame during pans, so it must stay allocation-light. The values are
  // `Object.assign`ed onto the views, so the keys are view properties
  // (`translateX`), despite the declared TrData type.
  const translation: TranslationFunctionType = (side, width, _value, delta, progress, drawer) => {
    const push = side === "left" ? delta : -delta;
    // A programmatic open/close evaluates this once, for the target, and then
    // animates; the composer follows that animation in `animate` instead.
    if ((drawer as unknown as { mIsPanning?: boolean }).mIsPanning) translateComposer(push);
    return {
      mainContent: { translateX: push },
      leftDrawer: { translateX: -(width - delta) * 0.4 },
      backDrop: { translateX: push, opacity: progress },
    } as unknown as ReturnType<TranslationFunctionType>;
  };

  // Invoked ahead of the drawer's own open/close animation with its duration;
  // resolving at once keeps the composer's animation concurrent with it. By
  // now the drawer has rewritten the translation data into animation form
  // (`translate: { x }`), which is where the target lives.
  const animate: AnimationFunctionType = (_side, duration, trData) => {
    const main = (trData as unknown as { mainContent?: { translate?: { x?: number } } }).mainContent;
    translateComposer(main?.translate?.x ?? 0, duration);
    return Promise.resolve();
  };

  const closeDrawer = () => {
    drawerRef.current?.close();
  };

  // Shared by the hamburger and pan-driven opens (only the latter raise `start`).
  const beginOpen = () => {
    dismissKeyboard();
    setComposerPushed(OPEN_CORNER_RADIUS);
    if (mainRef.current) mainRef.current.borderRadius = OPEN_CORNER_RADIUS;
  };

  const openDrawer = () => {
    beginOpen();
    drawerRef.current?.open("left");
  };

  return (
    <drawer
      ref={drawerRef}
      leftDrawerMode="under"
      gestureEnabled={true}
      backdropColor={BACKDROP}
      translationFunction={translation}
      animationFunction={animate}
      onStart={beginOpen}
      onOpen={() => drawerHaptic()}
      onClose={() => {
        drawerHaptic();
        setComposerPushed(0);
        translateComposer(0);
        if (mainRef.current) mainRef.current.borderRadius = 0;
      }}
    >
      <gridlayout hostSlot="mainContent" ref={mainRef} class="screen main-panel">
        <ChatScreen onMenu={openDrawer} />
      </gridlayout>
      <gridlayout hostSlot="leftDrawer" width={drawerWidth} class="drawer">
        <DrawerPanel
          onClose={closeDrawer}
          onSettings={() => {
            tapHaptic();
            const host = mainRef.current;
            if (host) openSettings(host);
          }}
        />
      </gridlayout>
    </drawer>
  );
}
