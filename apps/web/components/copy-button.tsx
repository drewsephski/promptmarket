"use client";

import { useState } from "react";
import { CheckMark, CopyMark } from "./marks";

interface CopyButtonProps {
  value: string;
  label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
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
      onClick={function onCopy() {
        void handleClick();
      }}
      aria-label={copied ? "Copied" : label}
    >
      <span className="pill-copy-label">
        <span aria-hidden={copied}>Copy</span>
        <span aria-hidden={!copied}>Copied</span>
      </span>
      <span className="pill-mark" aria-hidden="true">
        {copied ? <CheckMark /> : <CopyMark />}
      </span>
    </button>
  );
}
