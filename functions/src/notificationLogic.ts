export type MessagePreviewInput = {
  type?: unknown;
  text?: unknown;
};

export function messageNotificationPreview(input: MessagePreviewInput): string {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text) return text.slice(0, 120);
  switch (input.type) {
    case "image": return "أرسل صورة";
    case "audio": return "أرسل رسالة صوتية";
    case "video": return "أرسل مقطع فيديو";
    default: return "أرسل رسالة جديدة";
  }
}
