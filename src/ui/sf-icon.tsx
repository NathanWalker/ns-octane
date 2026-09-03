import { isIOS, type EventData, type Image as NsImage } from "@nativescript/core";
import type { MenuAction } from "@nstudio/nativescript-menu";
import { MENU_BACKGROUND_OPACITY } from "./menu";

type Weight = "light" | "regular" | "medium" | "semibold" | "bold";

export interface SfIconProps {
  /** SF Symbol name (iOS). */
  name: string;
  /** Symbol point size — the glyph, not the view; the view centers it. */
  size?: number;
  weight?: Weight;
  /** Font Awesome fallback glyph for Android. */
  fa?: string;
  /** Font class for the Android fallback ("fas" | "far"). */
  faClass?: string;
  class?: string;
  col?: number;
  row?: number;
  width?: number;
  height?: number;
  verticalAlignment?: "top" | "middle" | "bottom" | "stretch";
  horizontalAlignment?: "left" | "center" | "right" | "stretch";
  marginLeft?: number;
  marginRight?: number;
  marginBottom?: number;
  marginTop?: number;
  visibility?: "visible" | "collapse";
  onTap?: (event: EventData) => void;
  menu?: MenuAction[] | MenuAction;
  contextMenu?: MenuAction[] | MenuAction;
  androidBackgroundOpacity?: number;
}

function weightOf(weight: Weight): UIImageSymbolWeight {
  switch (weight) {
    case "light":
      return UIImageSymbolWeight.Light;
    case "medium":
      return UIImageSymbolWeight.Medium;
    case "semibold":
      return UIImageSymbolWeight.Semibold;
    case "bold":
      return UIImageSymbolWeight.Bold;
    default:
      return UIImageSymbolWeight.Regular;
  }
}

/**
 * An SF Symbol drawn at a fixed point size, centered in the view (whatever its
 * dimensions), tinted by the CSS `tint-color` of its class. Falls back to a
 * Font Awesome label on Android.
 */
export function SfIcon({ name, size = 17, weight = "regular", fa, faClass, ...rest }: SfIconProps) {
  if (!isIOS) {
    const opacity = rest.androidBackgroundOpacity ?? (rest.menu || rest.contextMenu ? MENU_BACKGROUND_OPACITY : undefined);
    return (
      <label
        {...rest}
        androidBackgroundOpacity={opacity}
        class={`${rest.class ?? ""} ${faClass ?? "fas"}`}
        text={fa ?? ""}
      />
    );
  }
  return (
    <image
      {...rest}
      onLoaded={(args: EventData) => {
        // NS `stretch` has no "center"; configure the native view directly so
        // the glyph renders at its natural size, centered.
        const imageView = (args.object as NsImage).ios as UIImageView;
        if (!imageView) return;
        imageView.contentMode = UIViewContentMode.Center;
        imageView.image = UIImage.systemImageNamedWithConfiguration(
          name,
          UIImageSymbolConfiguration.configurationWithPointSizeWeight(size, weightOf(weight)),
        );
      }}
    />
  );
}
