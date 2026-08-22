import { Application, isIOS, Page, type NativeWindow } from "@nativescript/core";
import { registerSwiftUI, UIDataDriver } from "@nativescript/swift-ui";
import { renderNativeScriptApp } from "./octane/driver";
import { App } from "./app";

// Provided by App_Resources/iOS/src/OctaneLogo.swift. Run `ns typings ios` to
// generate real types for it; the declaration is enough to reference the class.
declare const OctaneLogoProvider: any;

if (isIOS) {
  registerSwiftUI(
    "octaneLogo",
    (view) => new UIDataDriver(OctaneLogoProvider.alloc().init(), view),
  );
}

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
  const windows = Application.getWindows();
  roots.set(
    window,
    renderNativeScriptApp(page, App, {
      windowRole: window?.role ?? "application",
      windowIndex: Math.max(1, windows.indexOf(window as NativeWindow) + 1),
    }),
  );
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
