import { Dialogs, isIOS } from "@nativescript/core";
import { useState } from "octane";

export function App() {
  // Driven into the Metal shaders as a uniform: tapping the logo pulses the
  // heat haze and ember sheen, then it settles back.
  const [intensity, setIntensity] = useState(1);

  return (
    <gridlayout rows="*,auto,auto,auto,*">
      {isIOS ? (
        <swiftui
          row={0}
          swiftId="octaneLogo"
          data={{ intensity }}
          height={140}
          marginBottom={16}
          verticalAlignment="bottom"
          onSwiftUIEvent={() => {
            setIntensity(2.6);
            setTimeout(() => setIntensity(1), 900);
          }}
        />
      ) : null}
      <label row={1} class="text-xl text-center">
        Try it out now
      </label>
      <label row={2} class="text-2xl text-center">
        with NativeScript 🔥
      </label>
      <button row={3} onTap={() => Dialogs.alert("Tapped!")} marginTop={10}>
        Tap me for an alert
      </button>
    </gridlayout>
  );
}
