import type {
  AnimationFunctionType,
  Drawer,
  DrawerEventData,
  TranslationFunctionType,
} from "@nativescript-community/ui-drawer";
import type { MenuAction } from "@nstudio/nativescript-menu";
import type { NativeCodeView } from "@nstudio/nstreamdown";

/** JSX types for the tags and attributes `src/elements.ts` registers. */
declare module "@nativescript-community/octane/intrinsics" {
  interface CommonAttributes {
    /** `@nstudio/nativescript-menu`: native tap-anchored menu (UIMenu on iOS). */
    menu?: MenuAction[] | MenuAction;
    /** `@nstudio/nativescript-menu`: native long-press context menu. */
    contextMenu?: MenuAction[] | MenuAction;
    /** `@nstudio/nativescript-menu`: Android popup background opacity, 0..1. */
    androidBackgroundOpacity?: number;
  }

  interface NativeScriptElements {
    /**
     * `@nativescript-community/ui-drawer` — children declare their slot via
     * `hostSlot="mainContent"` / `hostSlot="leftDrawer"` etc.
     */
    drawer: Attributes<typeof Drawer> & {
      /** Function-valued properties, excluded by the ViewProperties filter. */
      translationFunction?: TranslationFunctionType;
      animationFunction?: AnimationFunctionType;
      onStart?: (event: DrawerEventData) => void;
      onOpen?: (event: DrawerEventData) => void;
      onClose?: (event: DrawerEventData) => void;
      onEnd?: (event: DrawerEventData) => void;
    };

    /** `@nstudio/nstreamdown`'s syntax-highlighted code block view. */
    nativecodeview: Attributes<typeof NativeCodeView>;
  }
}
