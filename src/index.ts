import { Application, Color, isIOS, Page } from "@nativescript/core";
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

Application.run({
  create() {
    const page = new Page();
    page.actionBarHidden = true;
    page.backgroundColor = new Color("#eef6f5");

    renderNativeScriptApp(page, App);

    return page;
  },
});
