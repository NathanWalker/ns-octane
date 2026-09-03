import { Utils, isIOS } from "@nativescript/core";
import { restoreComposer, suspendComposer } from "../state/accessory";
import type { Conversation } from "../state/store";

/** Native share sheet. `onDone` fires when the sheet closes (iOS only). */
export function shareText(text: string, onDone?: () => void): void {
  if (isIOS) {
    const controller = UIActivityViewController.alloc().initWithActivityItemsApplicationActivities(
      [text] as never,
      null,
    );
    controller.completionWithItemsHandler = () => onDone?.();
    const root = Utils.ios.getVisibleViewController(Utils.ios.getRootViewController());
    const popover = controller.popoverPresentationController;
    if (popover) {
      popover.sourceView = root.view;
      popover.sourceRect = CGRectMake(root.view.bounds.size.width / 2, 80, 1, 1);
    }
    root.presentViewControllerAnimatedCompletion(controller, true, null);
    return;
  }
  const intent = new android.content.Intent(android.content.Intent.ACTION_SEND);
  intent.setType("text/plain");
  intent.putExtra(android.content.Intent.EXTRA_TEXT, text);
  Utils.android
    .getCurrentActivity()
    ?.startActivity(android.content.Intent.createChooser(intent, "Share"));
  onDone?.();
}

/** Share a conversation transcript, suspending the docked composer while the sheet is up. */
export function shareConversation(conversation: Conversation): void {
  const transcript = conversation.messages
    .map((message) => (message.role === "user" ? `You: ${message.text}` : message.text))
    .join("\n\n");
  suspendComposer();
  shareText(transcript, restoreComposer);
}
