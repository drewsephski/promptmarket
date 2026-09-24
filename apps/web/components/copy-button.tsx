"use client";

import { useState } from "react";
import { CheckMark, CopyMark } from "./marks";

interface CopyButtonProps {
  value: string;
  label: string;
  text?: string;
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the selection fallback.
    }
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) {
    throw new Error("Could not copy");
  }
}

export function CopyButton({ value, label, text = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick(): Promise<void> {
    setCopied(true);
    try {
      await writeClipboard(value);
      window.setTimeout(function clearCopied() {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="pill"
      data-copied={copied ? "true" : "false"}
      onClick={function onCopy() {
        void handleClick();
      }}
      aria-label={copied ? "Copied" : label}
    >
      <span className="pill-copy-label">
        <span aria-hidden={copied}>{text}</span>
        <span aria-hidden={!copied}>Copied</span>
      </span>
      <span className="pill-mark" aria-hidden="true">
        {copied ? <CheckMark /> : <CopyMark />}
      </span>
    </button>
  );
}
