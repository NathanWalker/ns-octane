import { Application, Color } from "@nativescript/core";
import { document, registerAllElements } from "dominative";
import { startReactApp } from "@nativescript-community/react";
import { App } from "./app";
registerAllElements();

// Match the implicit NativeScript Page background to `.page-wrap`, including
// Android edge-to-edge system bar regions.
document.body.style.backgroundColor = new Color("#eef6f5");

startReactApp({
  Application,
  document,
  root: App,
});
