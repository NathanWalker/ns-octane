import { registerElement } from "@nativescript-community/octane";
import { SwiftUI } from "@nativescript/swift-ui";
import { Embers } from "./elements/embers";

registerElement("swiftui", SwiftUI);
registerElement("embers", Embers);

// Re-registering a tag with a new class recreates its live instances in place,
// so an update to this module needs no remount.
import.meta.hot?.accept();
