/**
 * Octane flavor for `@nstudio/nstreamdown` — the same shape as the plugin's
 * solid/react/vue flavors (content/config/isStreaming/onLinkTap over the
 * shared parser), rendering through this app's NativeScript driver. Math and
 * mermaid tokens are not handled here yet.
 */
import { Application, Color, type SystemAppearanceChangedEventData } from "@nativescript/core";
import { copyToClipboard, parseInlineFormatting, parseMarkdown } from "@nstudio/nstreamdown";
import type { MarkdownToken } from "@nstudio/nstreamdown";
import { useMemo, useState, useSyncExternalStore } from "octane";

type Key = { key?: string | number };

// Lives here rather than a shared plain module: the Octane compiler rewrites
// the "octane" import only in renderer-owned component files, and a hook
// imported from an uncompiled module binds a second runtime copy whose
// dispatcher is never active ("Cannot read properties of null (reading
// 'hooks')").
let appearance: "light" | "dark" = Application.systemAppearance() === "dark" ? "dark" : "light";
const appearanceListeners = new Set<() => void>();
Application.on("systemAppearanceChanged", (args) => {
  const next =
    (args as SystemAppearanceChangedEventData).newValue === "dark" ? "dark" : "light";
  if (next === appearance) return;
  appearance = next;
  for (const listener of appearanceListeners) listener();
});
const subscribeAppearance = (listener: () => void) => {
  appearanceListeners.add(listener);
  return () => {
    appearanceListeners.delete(listener);
  };
};

/** Re-renders on system light/dark switches — for colors set as props, not CSS. */
function useDarkMode(): boolean {
  return useSyncExternalStore(subscribeAppearance, () => appearance) === "dark";
}

export interface StreamdownConfig {
  /** `streaming` completes dangling markdown while tokens arrive. */
  mode?: "streaming" | "static";
  showCaret?: boolean;
  caret?: string;
}

export interface StreamdownProps {
  key?: string | number;
  content: string;
  config?: StreamdownConfig;
  onLinkTap?: (url: string) => void;
}

const CODE_FONT = "Menlo, monospace";
const LINK_COLOR = new Color("#0285ff");
const MUTED_COLOR = new Color("#9b9b9b");
const CODE_BG_DARK = new Color("#3a3a3a");
const CODE_BG_LIGHT = new Color("#f0f0f0");

function inlineChildren(token: MarkdownToken): MarkdownToken[] {
  if (token.children && token.children.length > 0) return token.children;
  if (token.content) return parseInlineFormatting(token.content);
  return [{ type: "text", raw: "", content: "" }];
}

function InlineSpans({
  token,
  dark,
  onLinkTap,
}: {
  token: MarkdownToken;
  dark: boolean;
  onLinkTap?: (url: string) => void;
}) {
  return (
    <formattedstring>
      {inlineChildren(token).map((child, index) => {
        const key = index;
        switch (child.type) {
          case "bold":
            return <span key={key} text={child.content} fontWeight="600" />;
          case "italic":
            return <span key={key} text={child.content} fontStyle="italic" />;
          case "bold-italic":
            return <span key={key} text={child.content} fontWeight="600" fontStyle="italic" />;
          case "code-inline":
            return (
              <span
                key={key}
                text={child.content}
                fontFamily={CODE_FONT}
                backgroundColor={dark ? CODE_BG_DARK : CODE_BG_LIGHT}
              />
            );
          case "strikethrough":
            return (
              <span key={key} text={child.content} color={MUTED_COLOR} textDecoration="line-through" />
            );
          case "link": {
            const url = (child.metadata?.["url"] as string) || child.content;
            return (
              <span
                key={key}
                text={child.content}
                color={LINK_COLOR}
                textDecoration="underline"
                onLinkTap={onLinkTap ? () => onLinkTap(url) : undefined}
              />
            );
          }
          default:
            return <span key={key} text={child.content} />;
        }
      })}
    </formattedstring>
  );
}

function headingClass(type: string): string {
  const level = Number(type.replace("heading", "")) || 1;
  return level <= 2 ? "md-h2" : "md-h3";
}

function CodeBlock({ code, language }: Key & { code: string; language: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <gridlayout rows="auto, auto" class="code-card">
      <gridlayout row={0} columns="*, auto" class="code-head">
        <label col={0} text={language || "code"} class="code-lang" />
        <label
          col={1}
          text={copied ? "Copied" : "Copy"}
          class="code-copy"
          onTap={() => {
            if (copyToClipboard(code)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        />
      </gridlayout>
      <scrollview row={1} orientation="horizontal">
        <nativecodeview code={code} language={language || "typescript"} darkMode={true} class="code-body" />
      </scrollview>
    </gridlayout>
  );
}

function ListBlock({
  token,
  ordered,
  dark,
  onLinkTap,
}: Key & {
  token: MarkdownToken;
  ordered: boolean;
  dark: boolean;
  onLinkTap?: (url: string) => void;
}) {
  return (
    <stacklayout class="md-list">
      {(token.children ?? []).map((item, index) => {
        const task = item.metadata?.["isTask"] === true;
        const checked = item.metadata?.["isChecked"] === true;
        const bullet = task
          ? checked
            ? "☑"
            : "☐"
          : ordered
            ? `${item.metadata?.["number"] ?? index + 1}.`
            : "•";
        return (
          <gridlayout key={index} rows="auto" columns="26,*" class="md-li-row">
            <label col={0} text={bullet} class={task && checked ? "md-bullet md-done" : "md-bullet"} />
            <label col={1} textWrap={true} class={checked ? "md-li md-done" : "md-li"}>
              <InlineSpans token={item} dark={dark} onLinkTap={onLinkTap} />
            </label>
          </gridlayout>
        );
      })}
    </stacklayout>
  );
}

function TableBlock({
  token,
  dark,
  onLinkTap,
}: Key & {
  token: MarkdownToken;
  dark: boolean;
  onLinkTap?: (url: string) => void;
}) {
  const rows = (token.children ?? []).filter((row) => row.metadata?.["isSeparator"] !== true);
  const columnCount = rows[0]?.children?.length ?? 1;
  const columns = new Array(columnCount).fill("auto").join(", ");
  return (
    <scrollview orientation="horizontal" class="md-table">
      <stacklayout>
        {rows.map((row, rowIndex) => (
          <gridlayout key={rowIndex} rows="auto" columns={columns} class={row.metadata?.["isHeader"] ? "md-tr md-th" : "md-tr"}>
            {(row.children ?? []).map((cell, cellIndex) => (
              <label key={cellIndex} col={cellIndex} textWrap={false} class="md-td">
                <InlineSpans token={cell} dark={dark} onLinkTap={onLinkTap} />
              </label>
            ))}
          </gridlayout>
        ))}
      </stacklayout>
    </scrollview>
  );
}

export function Streamdown({ content, config, onLinkTap }: StreamdownProps) {
  const dark = useDarkMode();
  const mode = config?.mode ?? "streaming";
  const parsed = useMemo(
    () => (content ? parseMarkdown(content, mode === "streaming") : { tokens: [], isComplete: true }),
    [content, mode],
  );
  const caretVisible = (config?.showCaret ?? true) && mode === "streaming" && !parsed.isComplete;
  const caret = config?.caret ?? "●";

  return (
    <stacklayout>
      {parsed.tokens.map((token, index) => {
        const key = `${index}-${token.type}`;
        if (token.type.startsWith("heading")) {
          return (
            <label key={key} textWrap={true} class={headingClass(token.type)}>
              <InlineSpans token={token} dark={dark} onLinkTap={onLinkTap} />
            </label>
          );
        }
        switch (token.type) {
          case "paragraph":
            return (
              <label key={key} textWrap={true} class="md-p">
                <InlineSpans token={token} dark={dark} onLinkTap={onLinkTap} />
              </label>
            );
          case "code-block":
            return (
              <CodeBlock
                key={key}
                code={token.content}
                language={(token.metadata?.["language"] as string) || ""}
                dark={dark}
              />
            );
          case "blockquote":
            return (
              <gridlayout key={key} rows="auto" columns="3,*" class="md-quote-row">
                <stacklayout col={0} class="md-quote-bar" />
                <label col={1} textWrap={true} class="md-quote">
                  <InlineSpans token={token} dark={dark} onLinkTap={onLinkTap} />
                </label>
              </gridlayout>
            );
          case "list-ordered":
            return <ListBlock key={key} token={token} ordered={true} dark={dark} onLinkTap={onLinkTap} />;
          case "list-unordered":
            return <ListBlock key={key} token={token} ordered={false} dark={dark} onLinkTap={onLinkTap} />;
          case "table":
            return <TableBlock key={key} token={token} dark={dark} onLinkTap={onLinkTap} />;
          case "horizontal-rule":
            return <stacklayout key={key} class="md-hr" />;
          case "image": {
            const url = (token.metadata?.["url"] as string) || "";
            return url ? <image key={key} src={url} stretch="aspectFit" class="md-img" /> : null;
          }
          default:
            return null;
        }
      })}
      {caretVisible ? <label text={caret} class="md-caret" /> : null}
    </stacklayout>
  );
}
