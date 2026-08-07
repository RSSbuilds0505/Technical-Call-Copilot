"use client";

import { useState } from "react";
import { Button } from "./index";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard unavailable (permissions/insecure context); no-op with visual feedback skipped.
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
