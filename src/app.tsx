import { isIOS } from "@nativescript/core";
import { useState } from "octane";

export function App() {
  const [intensity, setIntensity] = useState(1);
  const [burst, setBurst] = useState(0);

  return (
    <gridlayout rows="*,auto,auto,auto,*">
      {isIOS ? (
        <swiftui
          row={0}
          swiftId="octaneLogo"
          data={{ intensity, burst }}
          height={190}
          verticalAlignment="bottom"
          onSwiftUIEvent={() => {
            setIntensity(2.6);
            setTimeout(() => setIntensity(1), 900);
          }}
        />
      ) : null}
      <label row={1} class="text-xl text-center text-octane">
        Try it now
      </label>
      <label row={2} class="text-2xl text-center text-octane">
        with NativeScript
      </label>
      <button row={3} onTap={() => setBurst(burst + 1)} class="mt-10 font-bold">
        Tap to ignite 🔥
      </button>
    </gridlayout>
  );
}
