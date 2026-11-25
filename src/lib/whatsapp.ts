import { brand } from "@/lib/brand";

/**
 * Mensagem que o cliente já encontra escrita no campo do WhatsApp — ele só
 * aperta enviar. Deve funcionar sozinha, sem o cliente precisar preencher nada.
 */
export const WHATSAPP_MESSAGE = [
  "Olá! Vim pelo site da AiDEX e quero saber mais sobre o AiDEX G7.",
  "",
  "Gostaria de entender qual plano combina comigo, como funciona a entrega e se o sensor precisa de transmissor separado.",
  "",
  "Pode me ajudar?",
].join("\n");

/** Link wa.me com a mensagem pronta (ou uma mensagem própria). */
export function whatsappHref(
  message: string = WHATSAPP_MESSAGE,
  phone: string = brand.whatsapp.phoneE164,
) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Formatação para números brasileiros ou internacionais guardados só com dígitos. */
export function formatWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const area = digits.slice(2, 4);
    const subscriber = digits.slice(4);
    const split = subscriber.length === 9 ? 5 : 4;
    return `+55 (${area}) ${subscriber.slice(0, split)}-${subscriber.slice(split)}`;
  }
  return `+${digits}`;
}
