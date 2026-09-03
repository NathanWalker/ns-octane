import {
  Application,
  CoreTypes,
  Page,
  TouchManager,
  isAndroid,
  type NativeWindow,
} from "@nativescript/core";
import { install as installGestureHandler } from "@nativescript-community/gesturehandler";
import { renderNativeScriptApp } from "@nativescript-community/octane";
import "./elements";
import { App } from "./app";

// ui-drawer's pan tracking rides on the community gesture handler.
installGestureHandler();

// Every tappable view depresses slightly on touch; views opt out with
// `ignoreTouchAnimation` (the chat scroll surface does).
TouchManager.enableGlobalTapAnimations = true;
TouchManager.animations = {
  down: {
    scale: { x: 0.95, y: 0.95 },
    duration: 130,
    curve: CoreTypes.AnimationCurve.easeOut,
  },
  up: {
    scale: { x: 1, y: 1 },
    duration: 220,
    curve: CoreTypes.AnimationCurve.easeOut,
  },
};

/**
 * One Octane root per window. Every window — the phone screen, a second iPad
 * scene, a CarPlay or external-display scene — renders the same `App`, so a
 * hot update to it reaches all of them through the one component wrapper they
 * share.
 */
const roots = new Map<NativeWindow | undefined, ReturnType<typeof renderNativeScriptApp>>();

function createWindowContent(window: NativeWindow | undefined): Page {
  const page = new Page();
  page.actionBarHidden = true;
  // Core pads the root view by the system bars. Skipping both edges lets the
  // canvas run under the status bar and the gesture strip; each screen pads
  // its own chrome from `safeAreaInsets()` instead.
  if (isAndroid) page.androidOverflowEdge = "top,bottom";
  roots.set(window, renderNativeScriptApp(page, App));
  return page;
}

Application.setWindowContentResolver(({ window, isPrimary }) =>
  isPrimary ? undefined : createWindowContent(window),
);

const onWindowClose = ({ window }: { window: NativeWindow }) => {
  roots.get(window)?.unmount();
  roots.delete(window);
};
Application.on("windowClose", onWindowClose);

Application.run({
  create: () => createWindowContent(Application.primaryWindow),
});

// A module-graph reload re-evaluates this entry and mounts fresh roots; the
// ones this evaluation created must not outlive it.
import.meta.hot?.dispose(() => {
  Application.off("windowClose", onWindowClose);
  for (const root of roots.values()) root.unmount();
  roots.clear();
});
