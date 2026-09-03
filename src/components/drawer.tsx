import type { MenuAction } from "@nstudio/nativescript-menu";
import { useSyncExternalStore } from "octane";
import { deleteConversation, getState, newChat, openChat, subscribe, type Conversation } from "../state/store";
import { tapHaptic } from "../ui/haptics";
import { icons } from "../ui/icons";
import { SfIcon } from "../ui/sf-icon";
import { isAndroid } from "@nativescript/core";
import { MENU_BACKGROUND_OPACITY } from "../ui/menu";
import { safeAreaInsets } from "../ui/safe-area";
import { shareConversation } from "../ui/share";

const NAV_ITEMS = [
  { sf: "photo.on.rectangle", fa: icons.images, faClass: "far", text: "Images" },
  { sf: "books.vertical", fa: icons.library, faClass: "fas", text: "Library" },
  { sf: "folder", fa: icons.projects, faClass: "far", text: "Projects" },
  { sf: "laptopcomputer", fa: icons.remote, faClass: "fas", text: "Remote" },
  { sf: "clock", fa: icons.scheduled, faClass: "far", text: "Scheduled" },
  { sf: "ellipsis", fa: icons.ellipsis, faClass: "fas", text: "More" },
];

function recentMenu(conversation: Conversation): MenuAction[] {
  return [
    {
      name: "Share",
      icon: "square.and.arrow.up",
      action: () => {
        tapHaptic();
        shareConversation(conversation);
      },
    },
    { name: "Pin", icon: "pin", action: () => tapHaptic() },
    { name: "Archive", icon: "archivebox", action: () => tapHaptic() },
    {
      name: "Delete",
      icon: "trash",
      destructive: true,
      action: () => {
        tapHaptic();
        deleteConversation(conversation.id);
      },
    },
  ];
}

export interface DrawerPanelProps {
  onClose: () => void;
  onSettings: () => void;
}

export function DrawerPanel({ onClose, onSettings }: DrawerPanelProps) {
  const state = useSyncExternalStore(subscribe, getState);
  const recents = [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const { top, bottom } = safeAreaInsets();

  return (
    <gridlayout rows="auto, auto, *, auto" class="drawer" iosOverflowSafeArea={true}>
      <gridlayout row={0} rows="auto" columns="*, auto" paddingTop={isAndroid ? top + 12 : top > 0 ? 12 : 24} class="px-5 pb-3">
        <label col={0} text="Octane" class="drawer-title" verticalAlignment="middle" />
        <SfIcon
          col={1}
          name="magnifyingglass"
          size={16}
          weight="medium"
          class="drawer-icon-btn"
          fa={icons.search}
          onTap={() => tapHaptic()}
        />
      </gridlayout>

      <stacklayout row={1} class="px-3">
        {NAV_ITEMS.map((item) => (
          <gridlayout key={item.text} rows="auto" columns="auto, *" class="p-2.5 rounded-xl" onTap={() => tapHaptic()}>
            <SfIcon
              col={0}
              name={item.sf}
              size={16}
              class="drawer-item-icon"
              fa={item.fa}
              faClass={item.faClass}
              height={24}
            />
            <label col={1} text={item.text} class="drawer-item-text" />
          </gridlayout>
        ))}
      </stacklayout>

      <scrollview row={2} class="mt-2">
        <stacklayout class="px-5 pb-4">
          <label text="Recents" class="drawer-section py-2" />
          {recents.map((conversation) => (
            <label
              key={conversation.id}
              text={conversation.title}
              class="drawer-recent"
              contextMenu={recentMenu(conversation)}
              androidBackgroundOpacity={MENU_BACKGROUND_OPACITY}
              onTap={() => {
                openChat(conversation.id);
                onClose();
              }}
            />
          ))}
        </stacklayout>
      </scrollview>

      <gridlayout row={3} rows="auto" columns="auto, *, auto" class="px-5 pt-2" paddingBottom={bottom + 10}>
        {/* Star row on purpose: an auto row in this fixed-height pill would
            hug the labels at the top instead of letting them center. */}
        <gridlayout
          col={0}
          columns="auto, auto"
          class="chat-fab"
          onTap={() => {
            tapHaptic();
            newChat();
            onClose();
          }}
        >
          <SfIcon
            col={0}
            name="square.and.pencil"
            size={16}
            weight="medium"
            class="chat-fab-text"
            fa={icons.compose}
            faClass="far"
            width={22}
            height={22}
            marginRight={8}
          />
          <label col={1} text="Chat" class="chat-fab-text" />
        </gridlayout>
        <SfIcon
          col={2}
          name="gearshape"
          size={17}
          class="drawer-icon-btn"
          fa={icons.gear}
          onTap={onSettings}
        />
      </gridlayout>
    </gridlayout>
  );
}
