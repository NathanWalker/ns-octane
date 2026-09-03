import { registerElement } from "@nativescript-community/octane";
import { Drawer } from "@nativescript-community/ui-drawer";
// Side effect: registers the `menu` / `contextMenu` properties on every View.
import "@nstudio/nativescript-menu";
import { NativeCodeView } from "@nstudio/nstreamdown";

registerElement("drawer", Drawer);
registerElement("nativecodeview", NativeCodeView);

// Re-registering a tag with a new class recreates its live instances in place,
// so an update to this module needs no remount.
import.meta.hot?.accept();
