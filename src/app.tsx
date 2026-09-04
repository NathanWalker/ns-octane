import { Application, isIOS } from "@nativescript/core";
import type { SwiftUI } from "@nativescript/swift-ui";
import { useEffect, useRef, useState } from "octane";
import type { Embers } from "./elements/embers";
import { subscribeFlame } from "./flame/flame";
import { tagline } from "./theme";

export interface AppProps {
  /** `application`, `embedded`, `carplay` or `externalDisplay`. */
  windowRole: string;
  windowIndex: number;
}

export function App({ windowRole, windowIndex }: AppProps) {
  const [burst, setBurst] = useState(0);
  const logo = useRef<SwiftUI | null>(null);
  const embers = useRef<Embers | null>(null);
  // Per-frame values never enter component state: the worker's intensity and
  // the tap boost are pushed straight to the native views through refs, so a
  // 30fps flame costs no re-renders and no host-command diffs.
  const flame = useRef({ intensity: 1, boost: 0, burst: 0 });

  const push = () => {
    const { intensity, boost, burst } = flame.current;
    if (logo.current) logo.current.data = { intensity: intensity + boost, burst };
    if (embers.current) embers.current.heat = intensity;
  };

  useEffect(
    () =>
      subscribeFlame((intensity) => {
        flame.current.intensity = intensity;
        push();
      }),
    [],
  );

  return (
    <gridlayout rows="*,auto,auto,auto,*">
      <embers ref={embers} row={0} height={230} verticalAlignment="bottom" />
      {isIOS ? (
        <swiftui
          ref={logo}
          row={0}
          swiftId="octaneLogo"
          height={190}
          verticalAlignment="bottom"
          onSwiftUIEvent={() => {
            flame.current.boost = 1.6;
            push();
            setTimeout(() => {
              flame.current.boost = 0;
              push();
            }, 900);
          }}
        />
      ) : null}
      <label row={1} class="text-xl text-center text-octane">
        Hot, right now
      </label>
      <label row={2} class="text-2xl text-center text-octane">
        {tagline}
      </label>
      <button
        row={3}
        class="mt-10 font-bold"
        onTap={() => {
          const next = burst + 1;
          setBurst(next);
          flame.current.burst = next;
          push();
        }}
      >
        Tap to ignite 🔥 {burst}
      </button>
      <label
        row={4}
        class="text-center text-octane"
        verticalAlignment="bottom"
        onTap={() => Application.openWindow()}
      >
        {`window ${windowIndex} · ${windowRole}`}
      </label>
    </gridlayout>
  );
}
