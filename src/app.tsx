import { Dialogs } from "@nativescript/core";

export function App() {
  return (
    <gridlayout rows="*,auto,auto,*">
      <label row={1} textAlignment="center">
        Let's try out Octane!
      </label>
      <button row={2} onTap={() => Dialogs.alert("Tapped!")} marginTop={10}>
        Tap me for an alert
      </button>
    </gridlayout>
  );
}
