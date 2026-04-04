import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../types";
import { postMessage } from "../shared/vscode-api";

export async function handlePasteWithImageSupport(): Promise<void> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => ALLOWED_IMAGE_TYPES.includes(t));
      if (imageType) {
        const blob = await item.getType(imageType);
        if (blob.size > MAX_IMAGE_SIZE) {
          console.warn("Image too large, falling back to text paste");
          break;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            postMessage({
              type: "imagePasted",
              data: reader.result,
            });
          }
        };
        reader.onerror = () => {
          console.error("FileReader failed to read image");
          postMessage({ type: "triggerPaste" });
        };
        reader.onabort = () => {
          postMessage({ type: "triggerPaste" });
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  } catch (err) {
    console.warn(
      "Could not read image from clipboard, falling back to text paste:",
      err,
    );
  }
  postMessage({ type: "triggerPaste" });
}

export function copySelectionToClipboard(selection: string): void {
  postMessage({
    type: "setClipboard",
    text: selection,
  });
}
