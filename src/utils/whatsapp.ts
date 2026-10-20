import { LanguageCode } from '../types';
import { LANGUAGES } from './languages';

export const AUTHOR_NAME = 'Waseem Asif';
export const AUTHOR_EMAIL = 'wasimasif761@gmail.com';

/**
 * Formats a clean translation note for WhatsApp
 */
export function formatWhatsAppMessage(
  sourceText: string,
  translatedText: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode
): string {
  const srcName = LANGUAGES[srcLang].name;
  const tgtName = LANGUAGES[tgtLang].name;

  return `*🎙️ VoiceLingo Translation Note*
━━━━━━━━━━━━━━━━━
🗣️ *Original (${srcName}):*
${sourceText.trim()}

✨ *Translation (${tgtName}):*
${translatedText.trim()}
━━━━━━━━━━━━━━━━━
🌐 Created with VoiceLingo PWA (by ${AUTHOR_NAME})
🔗 ${window.location.origin}`;
}

/**
 * Generates the WhatsApp share URL for text
 */
export function getWhatsAppTextShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Open WhatsApp with translated text
 */
export function shareTextOnWhatsApp(
  sourceText: string,
  translatedText: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode
): boolean {
  if (!sourceText.trim() && !translatedText.trim()) return false;
  const msg = formatWhatsAppMessage(sourceText, translatedText, srcLang, tgtLang);
  const url = getWhatsAppTextShareUrl(msg);
  window.open(url, '_blank');
  return true;
}

/**
 * Share Voice / Audio file on WhatsApp via Web Share API or download fallback
 */
export async function shareVoiceOnWhatsApp(
  audioBlob: Blob | null,
  fileName = 'voicelingo-voice-clip.webm'
): Promise<{ success: boolean; method: 'web-share' | 'download'; message: string }> {
  if (!audioBlob) {
    return {
      success: false,
      method: 'download',
      message: 'No recorded audio available to share. Please record your voice first.',
    };
  }

  const file = new File([audioBlob], fileName, { type: audioBlob.type || 'audio/webm' });

  // Check if Web Share API with files is supported (supported on Android/iOS/Chrome)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'VoiceLingo Voice Recording',
        text: `Voice note recorded with VoiceLingo PWA (by ${AUTHOR_NAME})`,
      });
      return {
        success: true,
        method: 'web-share',
        message: 'Audio shared successfully via share sheet! Select WhatsApp to send.',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'web-share', message: 'Sharing was cancelled.' };
      }
      console.warn('Web Share failed, fallback to download:', err);
    }
  }

  // Fallback: trigger file download and open WhatsApp
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return {
    success: true,
    method: 'download',
    message: 'Voice file downloaded! You can now attach it in WhatsApp.',
  };
}

/**
 * Share the PWA Website Link directly to WhatsApp
 */
export function shareWebsiteOnWhatsApp(): void {
  const appUrl = window.location.href;
  const message = `🎙️ *VoiceLingo — Voice-to-Voice Translation & Smart Notes PWA*
🚀 Speak or type in Urdu, Roman Urdu, English, and Arabic with instant AI translation, speech output, and offline support.

Try VoiceLingo here:
👉 ${appUrl}

Developed with ❤️ by ${AUTHOR_NAME}
📧 Feedback: ${AUTHOR_EMAIL}`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/**
 * Send feedback directly to Waseem Asif via Email or WhatsApp
 */
export function openWhatsAppFeedback(): void {
  const message = `Hello ${AUTHOR_NAME},\n\nI am using VoiceLingo and would like to share feedback:\n`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

export function openEmailFeedback(): void {
  const subject = encodeURIComponent('VoiceLingo App Feedback');
  const body = encodeURIComponent(`Hi ${AUTHOR_NAME},\n\nHere is my feedback for VoiceLingo:\n\n`);
  window.location.href = `mailto:${AUTHOR_EMAIL}?subject=${subject}&body=${body}`;
}
