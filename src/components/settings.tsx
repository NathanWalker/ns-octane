import { Color, GridLayout, isAndroid, isIOS, type View } from "@nativescript/core";

const ACCENT = new Color("#0285ff");
import { renderNativeScriptApp } from "@nativescript-community/octane";
import { restoreComposer, suspendComposer } from "../state/accessory";
import { tapHaptic } from "../ui/haptics";
import { icons } from "../ui/icons";
import { SfIcon } from "../ui/sf-icon";

interface RowProps {
  sf: string;
  fa: string;
  faClass?: string;
  text: string;
  detail?: string;
  accent?: boolean;
  divider?: boolean;
}

function Row({ sf, fa, faClass, text, detail, accent, divider }: RowProps) {
  return (
    <stacklayout>
      <gridlayout rows="auto" columns="auto, *, auto, auto" class="px-4 py-3.5" onTap={() => tapHaptic()}>
        <SfIcon
          col={0}
          name={sf}
          size={16}
          class={accent ? "sheet-row-icon tint-accent" : "sheet-row-icon"}
          fa={fa}
          faClass={faClass}
          height={24}
        />
        <label
          col={1}
          text={text}
          class="sheet-row-text"
          color={accent ? ACCENT : undefined}
        />
        {detail ? <label col={2} text={detail} class="sheet-row-detail" marginRight={8} /> : null}
        {!accent ? (
          <SfIcon
            col={3}
            name="chevron.right"
            size={12}
            weight="semibold"
            class="sheet-row-detail"
            fa={icons.chevronRight}
            width={14}
            height={24}
          />
        ) : null}
      </gridlayout>
      {divider ? <stacklayout class="sheet-divider" /> : null}
    </stacklayout>
  );
}

function SettingsSheet({ close }: { close: () => void }) {
  return (
    <gridlayout rows="auto, *" class="sheet">
      <gridlayout row={0} columns="*, auto" class="px-4 pt-4">
        <SfIcon col={1} name="xmark" size={15} weight="medium" class="drawer-icon-btn" fa={icons.close} onTap={close} />
      </gridlayout>
      <scrollview row={1}>
        <stacklayout class="pb-10">
          <label text="NW" class="avatar" horizontalAlignment="center" marginTop={4} />
          <label
            text="wwwalkerrun"
            class="text-primary text-xl font-semibold text-center"
            marginTop={12}
          />

          <label text="Customize Octane" class="sheet-section" />
          <stacklayout class="sheet-card mx-4">
            <Row sf="face.smiling" fa={icons.smile} faClass="far" text="Personalization" divider={true} />
            <Row sf="book" fa={icons.memory} text="Memory" divider={true} />
            <Row sf="puzzlepiece.extension" fa={icons.plug} text="Plugins" />
          </stacklayout>

          <label text="Account" class="sheet-section" />
          <stacklayout class="sheet-card mx-4">
            <Row sf="envelope" fa={icons.envelope} faClass="far" text="Email" detail="walkerrunpdx@gmail.com" divider={true} />
            <Row sf="phone" fa={icons.phone} text="Phone number" detail="+1 (503) 555-0104" divider={true} />
            <Row sf="creditcard" fa={icons.creditCard} faClass="far" text="Subscription" detail="Free" divider={true} />
            <Row sf="arrow.clockwise" fa={icons.refresh} text="Restore purchases" divider={true} />
            <Row sf="sparkle" fa={icons.sparkle} text="Upgrade plan" accent={true} />
          </stacklayout>

          <label text="Theme" class="sheet-section" />
          <stacklayout class="sheet-card mx-4">
            <Row sf="sun.max" fa={icons.appearance} faClass="far" text="Appearance" detail="System" />
          </stacklayout>
        </stacklayout>
      </scrollview>
    </gridlayout>
  );
}

/** Present settings as a native page sheet; suspends the docked composer while it is up. */
export function openSettings(host: View): void {
  suspendComposer();
  const container = new GridLayout();
  const root = renderNativeScriptApp(container, SettingsSheet, {
    close: () => container.closeModal(),
  });
  host.showModal(container, {
    context: {},
    animated: true,
    fullscreen: isAndroid,
    ios: isIOS ? ({ presentationStyle: UIModalPresentationStyle.PageSheet } as never) : undefined,
    closeCallback: () => {
      root.unmount();
      restoreComposer();
    },
  });
}
