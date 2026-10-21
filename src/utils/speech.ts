import { LanguageCode } from '../types';
import { LANGUAGES } from './languages';
import { urduScriptToRomanUrdu } from './translator';

export interface SpeechRecognitionCallbacks {
  onTranscript: (finalText: string, interimText: string) => void;
  onError: (errorMsg: string) => void;
  onStateChange: (isListening: boolean) => void;
}

/**
 * Removes immediate adjacent repeat phrases (e.g. "پڑھائی کے بارے میں پڑھائی کے بارے میں")
 * that frequently occur due to Web Speech API audio buffer repeats on Android / iOS.
 */
export function removeAdjacentRepeats(text: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return text.trim();

  let i = 0;
  const result: string[] = [];

  while (i < words.length) {
    let matchedGramLen = 0;
    // Check phrases up to 12 words long (e.g. "پڑھائی کے بارے میں" is 4 words)
    const maxGram = Math.min(12, Math.floor((words.length - i) / 2));

    for (let len = maxGram; len >= 1; len--) {
      let isRepeat = true;
      for (let j = 0; j < len; j++) {
        if (words[i + j].toLowerCase() !== words[i + len + j].toLowerCase()) {
          isRepeat = false;
          break;
        }
      }

      if (isRepeat) {
        // If single word repeat (len === 1), check if it repeats >= 2 or >= 3 times
        if (len === 1) {
          let count = 2;
          while (i + count < words.length && words[i + count].toLowerCase() === words[i].toLowerCase()) {
            count++;
          }
          if (count >= 3 || (words[i].toLowerCase() !== 'بہت' && words[i].toLowerCase() !== 'very')) {
            matchedGramLen = 1;
            break;
          }
        } else {
          matchedGramLen = len;
          break;
        }
      }
    }

    if (matchedGramLen > 0) {
      // Keep only one copy of the repeated phrase
      for (let j = 0; j < matchedGramLen; j++) {
        result.push(words[i + j]);
      }
      i += matchedGramLen * 2;

      // Skip any further consecutive duplicates of the exact same phrase (3x, 4x, etc.)
      while (i + matchedGramLen <= words.length) {
        let isAnotherRepeat = true;
        for (let j = 0; j < matchedGramLen; j++) {
          if (words[i + j].toLowerCase() !== words[i - matchedGramLen + j].toLowerCase()) {
            isAnotherRepeat = false;
            break;
          }
        }
        if (isAnotherRepeat) {
          i += matchedGramLen;
        } else {
          break;
        }
      }
    } else {
      result.push(words[i]);
      i++;
    }
  }

  return result.join(' ');
}

/**
 * Merges two transcript segments seamlessly, eliminating any duplicate words or phrases
 * at the boundary where the end of 'base' overlaps with the beginning of 'addition'.
 */
export function mergeTranscripts(base: string, addition: string): string {
  const cleanAddition = removeAdjacentRepeats(addition.trim());
  const cleanBase = removeAdjacentRepeats(base.trim());

  if (!cleanBase) return cleanAddition;
  if (!cleanAddition) return cleanBase;

  // 1. If base already ends with addition exactly
  if (cleanBase.toLowerCase().endsWith(cleanAddition.toLowerCase())) {
    return cleanBase;
  }

  // 2. Check if addition is already contained in the last portion of base
  if (cleanBase.length > cleanAddition.length) {
    const tailOfBase = cleanBase.slice(-cleanAddition.length * 2);
    if (tailOfBase.toLowerCase().includes(cleanAddition.toLowerCase())) {
      return cleanBase;
    }
  }

  // 3. Word-level suffix/prefix overlap detection
  const baseWords = cleanBase.split(/\s+/).filter(Boolean);
  const addWords = cleanAddition.split(/\s+/).filter(Boolean);

  const maxOverlap = Math.min(baseWords.length, addWords.length);
  let bestOverlap = 0;

  for (let k = maxOverlap; k >= 1; k--) {
    const baseSuffix = baseWords.slice(-k).map((w) => w.toLowerCase()).join(' ');
    const addPrefix = addWords.slice(0, k).map((w) => w.toLowerCase()).join(' ');
    if (baseSuffix === addPrefix) {
      bestOverlap = k;
      break;
    }
  }

  if (bestOverlap > 0) {
    const remainingAddWords = addWords.slice(bestOverlap);
    if (remainingAddWords.length === 0) {
      return cleanBase;
    }
    return removeAdjacentRepeats(`${cleanBase} ${remainingAddWords.join(' ')}`);
  }

  return removeAdjacentRepeats(`${cleanBase} ${cleanAddition}`);
}

/**
 * Computes interim text preview without displaying words already present at the end of base text.
 */
export function getInterimPreviewWithoutOverlap(base: string, interim: string): string {
  const cleanBase = base.trim();
  const cleanInterim = interim.trim();

  if (!cleanBase) return cleanInterim;
  if (!cleanInterim) return '';

  if (cleanBase.toLowerCase().endsWith(cleanInterim.toLowerCase())) {
    return '';
  }

  const baseWords = cleanBase.split(/\s+/).filter(Boolean);
  const interimWords = cleanInterim.split(/\s+/).filter(Boolean);

  const maxOverlap = Math.min(baseWords.length, interimWords.length);
  for (let k = maxOverlap; k >= 1; k--) {
    const baseSuffix = baseWords.slice(-k).map((w) => w.toLowerCase()).join(' ');
    const interimPrefix = interimWords.slice(0, k).map((w) => w.toLowerCase()).join(' ');
    if (baseSuffix === interimPrefix) {
      return interimWords.slice(k).join(' ');
    }
  }

  return cleanInterim;
}

export class VoiceRecognitionManager {
  private recognition: any = null;
  private isListening = false;
  private shouldKeepListening = false;
  private currentLang: LanguageCode = 'ur';
  private callbacks: SpeechRecognitionCallbacks;
  private accumulatedFinalText = '';
  private currentInterimText = '';
  private restartTimeout: any = null;
  private sessionFinalizedIndex = -1;

  constructor(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public setLanguage(lang: LanguageCode) {
    this.currentLang = lang;
    if (this.recognition && this.isListening) {
      try {
        const speechCode = LANGUAGES[lang]?.speechCode || 'ur-PK';
        this.recognition.lang = speechCode;
      } catch (e) {}
    }
  }

  public setInitialTranscript(text: string) {
    this.accumulatedFinalText = removeAdjacentRepeats(text.trim());
  }

  public reset(text = '') {
    this.accumulatedFinalText = removeAdjacentRepeats(text.trim());
    this.currentInterimText = '';
    this.sessionFinalizedIndex = -1;
  }

  /**
   * Starts Speech Recognition synchronously within the user gesture context.
   */
  public start(lang?: LanguageCode) {
    if (!this.isSupported()) {
      this.callbacks.onError(
        'Speech Recognition is not supported in this browser. Please open in Google Chrome or Edge.'
      );
      return;
    }

    if (lang) {
      this.currentLang = lang;
    }

    this.shouldKeepListening = true;
    this.currentInterimText = '';

    this.initAndStart();
  }

  private initAndStart() {
    if (!this.shouldKeepListening) return;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      if (this.recognition) {
        try {
          this.recognition.onstart = null;
          this.recognition.onresult = null;
          this.recognition.onerror = null;
          this.recognition.onend = null;
          this.recognition.abort();
        } catch (e) {}
        this.recognition = null;
      }

      this.sessionFinalizedIndex = -1;

      const SpeechRecognitionConstructor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      const rec = new SpeechRecognitionConstructor();
      this.recognition = rec;

      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      // Language selection
      const speechCode = LANGUAGES[this.currentLang]?.speechCode || 'ur-PK';
      rec.lang = speechCode;

      rec.onstart = () => {
        this.isListening = true;
        this.callbacks.onStateChange(true);
      };

      rec.onresult = (event: any) => {
        const newFinalChunks: string[] = [];
        let interim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          let transcriptText = res[0].transcript || '';

          // If user selected Roman Urdu, automatically transliterate recognized Urdu into Roman Urdu
          if (this.currentLang === 'ur-roman') {
            transcriptText = urduScriptToRomanUrdu(transcriptText);
          }

          if (res.isFinal) {
            // Process ONLY if not already finalized in this session
            if (i > this.sessionFinalizedIndex) {
              this.sessionFinalizedIndex = i;
              const cleaned = removeAdjacentRepeats(transcriptText.trim());
              if (cleaned) {
                newFinalChunks.push(cleaned);
              }
            }
          } else {
            // Only consider interim results from indices not yet finalized
            if (i > this.sessionFinalizedIndex) {
              const cleaned = transcriptText.trim();
              if (cleaned) {
                interim += (interim ? ' ' : '') + cleaned;
              }
            }
          }
        }

        if (newFinalChunks.length > 0) {
          for (const chunk of newFinalChunks) {
            this.accumulatedFinalText = mergeTranscripts(this.accumulatedFinalText, chunk);
          }
        }

        let displayInterim = removeAdjacentRepeats(interim);
        if (displayInterim && this.accumulatedFinalText) {
          displayInterim = getInterimPreviewWithoutOverlap(this.accumulatedFinalText, displayInterim);
        }

        this.currentInterimText = displayInterim;
        this.callbacks.onTranscript(this.accumulatedFinalText, displayInterim);
      };

      rec.onerror = (event: any) => {
        console.warn('SpeechRecognition event error:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.shouldKeepListening = false;
          this.isListening = false;
          this.callbacks.onError(
            'Microphone permission denied! براؤزر کی سیٹنگز میں مائیکروفون کی اجازت (Allow) دیں تاکہ آواز لکھی جا سکے۔'
          );
          this.callbacks.onStateChange(false);
          return;
        }

        if (event.error === 'audio-capture') {
          this.callbacks.onError('مائیکروفون دستیاب نہیں ہے۔ کوئی اور ایپ مائیک استعمال کر رہی ہے (Microphone busy).');
          return;
        }

        if (event.error === 'network') {
          // Network issue with speech services
          this.callbacks.onError('وائس سروس کنکشن کا مسئلہ۔ انٹرنیٹ چیک کریں (Speech service network error).');
          return;
        }

        // 'no-speech' is normal silence, we do not alert user
      };

      rec.onend = () => {
        this.isListening = false;

        if (this.shouldKeepListening) {
          // Restart gracefully with fresh instance for continuous dictation
          // Note: we do NOT blindly commit interim here during continuous listening,
          // because the restarted session will deliver the finalized text.
          this.restartTimeout = setTimeout(() => {
            if (this.shouldKeepListening) {
              this.initAndStart();
            }
          }, 80);
        } else {
          // User explicitly stopped: commit any final interim text safely with deduplication
          if (this.currentInterimText) {
            this.accumulatedFinalText = mergeTranscripts(this.accumulatedFinalText, this.currentInterimText);
            this.currentInterimText = '';
            this.callbacks.onTranscript(this.accumulatedFinalText, '');
          }
          this.callbacks.onStateChange(false);
        }
      };

      rec.start();
    } catch (err: any) {
      console.error('Failed to start SpeechRecognition:', err);
      this.callbacks.onError(err.message || 'Could not start microphone voice recognition.');
      this.isListening = false;
      this.callbacks.onStateChange(false);
    }
  }

  public stop() {
    this.shouldKeepListening = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    // Flush any pending interim speech into final text using deduplicated merge
    if (this.currentInterimText) {
      this.accumulatedFinalText = mergeTranscripts(this.accumulatedFinalText, this.currentInterimText);
      this.currentInterimText = '';
      this.callbacks.onTranscript(this.accumulatedFinalText, '');
    }

    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (e) {}
    }

    this.isListening = false;
    this.callbacks.onStateChange(false);
  }

  public getStatus(): boolean {
    return this.isListening;
  }
}

/**
 * Text-to-Speech Manager:
 * Uses Google Cloud TTS audio endpoint with fallback to window.speechSynthesis
 * Works 100% reliably for Urdu (اردو), Arabic (العربية), English, and Roman Urdu.
 */
export class TextToSpeechManager {
  private static synth: SpeechSynthesis | null =
    typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;
  private static currentAudio: HTMLAudioElement | null = null;
  private static isPlayingAudio = false;

  public static isSupported(): boolean {
    return true;
  }

  public static stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
      this.currentUtterance = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
      this.isPlayingAudio = false;
    }
  }

  public static isSpeaking(): boolean {
    return Boolean(this.synth?.speaking || this.isPlayingAudio);
  }

  public static async speak(
    text: string,
    lang: LanguageCode,
    options?: {
      rate?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    this.stop();

    const clean = text.trim();
    if (!clean) return;

    // Determine target TTS language code
    // Roman Urdu is spoken in natural Urdu accent
    const ttsCode = lang === 'ur-roman' ? 'ur' : lang;

    // Use High-Quality Cloud Audio stream first because Android/iOS often lack native Urdu/Arabic voices
    try {
      const trimmed = clean.slice(0, 350);
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsCode}&q=${encodeURIComponent(
        trimmed
      )}`;

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.isPlayingAudio = true;
      audio.playbackRate = options?.rate ?? 1.0;

      audio.onplay = () => {
        options?.onStart?.();
      };

      audio.onended = () => {
        this.isPlayingAudio = false;
        this.currentAudio = null;
        options?.onEnd?.();
      };

      audio.onerror = () => {
        this.isPlayingAudio = false;
        this.currentAudio = null;
        // Fallback to Web Speech Synthesis
        this.speakWithWebSpeech(clean, ttsCode, options);
      };

      await audio.play();
      return;
    } catch (e) {
      // Audio playback failed (e.g. autoplay restriction), fallback to WebSpeech
      this.speakWithWebSpeech(clean, ttsCode, options);
    }
  }

  private static speakWithWebSpeech(
    text: string,
    langCode: string,
    options?: {
      rate?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (!this.synth) {
      options?.onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      const fullCode =
        langCode === 'ur' ? 'ur-PK' : langCode === 'ar' ? 'ar-SA' : 'en-US';
      utterance.lang = fullCode;
      utterance.rate = options?.rate ?? 1.0;

      utterance.onstart = () => {
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        options?.onEnd?.();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        options?.onEnd?.();
      };

      this.synth.speak(utterance);
    } catch (e) {
      options?.onEnd?.();
    }
  }
}
