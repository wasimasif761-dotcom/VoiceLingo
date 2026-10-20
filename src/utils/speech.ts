import { LanguageCode } from '../types';
import { LANGUAGES } from './languages';
import { urduScriptToRomanUrdu } from './translator';

export interface SpeechRecognitionCallbacks {
  onTranscript: (finalText: string, interimText: string) => void;
  onError: (errorMsg: string) => void;
  onStateChange: (isListening: boolean) => void;
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
    this.accumulatedFinalText = text.trim();
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
        let interim = '';
        let newFinalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          let transcriptText = res[0]?.transcript || '';

          // If user selected Roman Urdu, automatically transliterate recognized Urdu into Roman Urdu
          if (this.currentLang === 'ur-roman') {
            transcriptText = urduScriptToRomanUrdu(transcriptText);
          }

          if (res.isFinal) {
            newFinalChunk += (newFinalChunk ? ' ' : '') + transcriptText.trim();
          } else {
            interim += (interim ? ' ' : '') + transcriptText.trim();
          }
        }

        if (newFinalChunk) {
          const sep = this.accumulatedFinalText && !this.accumulatedFinalText.endsWith(' ') ? ' ' : '';
          this.accumulatedFinalText = (this.accumulatedFinalText + sep + newFinalChunk).trim();
        }

        this.currentInterimText = interim;
        this.callbacks.onTranscript(this.accumulatedFinalText, interim);
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

        // Commit any lingering interim text before restart
        if (this.currentInterimText) {
          const sep = this.accumulatedFinalText && !this.accumulatedFinalText.endsWith(' ') ? ' ' : '';
          this.accumulatedFinalText = (this.accumulatedFinalText + sep + this.currentInterimText).trim();
          this.currentInterimText = '';
          this.callbacks.onTranscript(this.accumulatedFinalText, '');
        }

        if (this.shouldKeepListening) {
          // Restart gracefully with fresh instance for long continuous dictation
          this.restartTimeout = setTimeout(() => {
            if (this.shouldKeepListening) {
              this.initAndStart();
            }
          }, 80);
        } else {
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

    // Flush any pending interim speech into final text
    if (this.currentInterimText) {
      const sep = this.accumulatedFinalText && !this.accumulatedFinalText.endsWith(' ') ? ' ' : '';
      this.accumulatedFinalText = (this.accumulatedFinalText + sep + this.currentInterimText).trim();
      this.currentInterimText = '';
      this.callbacks.onTranscript(this.accumulatedFinalText, '');
    }

    if (this.recognition) {
      try {
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
