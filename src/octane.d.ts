import type { ContentView, EventData } from "@nativescript/core";
import type { SwiftUI } from "@nativescript/swift-ui";
import type { Embers } from "./elements/embers";

/** JSX types for the tags `src/elements.ts` registers. */
declare module "@nativescript-community/octane/intrinsics" {
  interface NativeScriptElements {
    /** `@nativescript/swift-ui` host view; iOS only, guard the element with `isIOS`. */
    swiftui: Omit<Attributes<typeof ContentView>, "children" | "ref"> & {
      swiftId: string;
      /** Sent to the provider's `updateData(data:)`. */
      data?: Record<string, unknown>;
      onSwiftUIEvent?: (event: EventData & { data: unknown }) => void;
      ref?: ((instance: SwiftUI | null) => void) | { current: SwiftUI | null } | null;
    };

    /** Rising ember particles — an element this app defines itself; see `src/elements/embers.ts`. */
    embers: Attributes<typeof Embers>;
  }
}
