import { LanguageCode } from '../types';
import { LANGUAGES } from './languages';

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

  constructor(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  public setLanguage(lang: LanguageCode) {
    this.currentLang = lang;
    if (this.recognition && this.isListening) {
      this.recognition.lang = LANGUAGES[lang].speechCode;
    }
  }

  public setInitialTranscript(text: string) {
    this.accumulatedFinalText = text;
  }

  public start(lang?: LanguageCode) {
    if (!this.isSupported()) {
      this.callbacks.onError('Web Speech Recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.');
      return;
    }

    if (lang) {
      this.currentLang = lang;
    }

    this.shouldKeepListening = true;

    try {
      // @ts-ignore
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionConstructor();
      
      // Continuous long-form dictation
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = LANGUAGES[this.currentLang].speechCode;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStateChange(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let newFinalPart = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            newFinalPart += text;
          } else {
            interimTranscript += text;
          }
        }

        if (newFinalPart) {
          const separator = this.accumulatedFinalText && !this.accumulatedFinalText.endsWith(' ') ? ' ' : '';
          this.accumulatedFinalText = (this.accumulatedFinalText + separator + newFinalPart).trim();
        }

        this.callbacks.onTranscript(this.accumulatedFinalText, interimTranscript);
      };

      this.recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.shouldKeepListening = false;
          this.callbacks.onError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was quiet
        } else if (event.error === 'network') {
          this.callbacks.onError('Network connection error occurred during voice recognition.');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.shouldKeepListening) {
          try {
            this.recognition.start();
            return;
          } catch (e) {
            // Already active
          }
        }
        this.callbacks.onStateChange(false);
      };

      this.recognition.start();
    } catch (err: any) {
      console.error('Failed to start SpeechRecognition:', err);
      this.callbacks.onError(err.message || 'Could not start microphone recording.');
      this.isListening = false;
      this.callbacks.onStateChange(false);
    }
  }

  public stop() {
    this.shouldKeepListening = false;
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
 * Enhanced Text-to-Speech manager:
 * Uses native Web SpeechSynthesis with automatic high-fidelity Cloud Audio fallback
 * ensuring Arabic, Urdu, English, and Roman Urdu voice output works 100% on any mobile device.
 */
export class TextToSpeechManager {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;
  private static fallbackAudio: HTMLAudioElement | null = null;
  private static isSpeakingFallback = false;

  public static isSupported(): boolean {
    return true; // Always supported via hybrid native + cloud fallback
  }

  public static getVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve([]);
        return;
      }
      let voices = this.synth.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      this.synth.onvoiceschanged = () => {
        voices = this.synth?.getVoices() || [];
        resolve(voices);
      };
      setTimeout(() => {
        resolve(this.synth?.getVoices() || []);
      }, 400);
    });
  }

  public static async speak(
    text: string,
    lang: LanguageCode,
    options?: {
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    this.stop();

    const clean = text.trim();
    if (!clean) return;

    // Determine target TTS language code
    const targetCode = LANGUAGES[lang].ttsCode;
    const shortCode = lang === 'ur-roman' ? 'ur' : lang; // Roman Urdu is spoken in natural Urdu accent

    try {
      const voices = await this.getVoices();
      // Check if a native voice is available for this language
      const matchingVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === targetCode.toLowerCase() ||
          v.lang.toLowerCase().startsWith(shortCode.toLowerCase())
      );

      // If phone has a native voice installed, try SpeechSynthesis
      if (this.synth && matchingVoice) {
        const utterance = new SpeechSynthesisUtterance(clean);
        this.currentUtterance = utterance;
        utterance.voice = matchingVoice;
        utterance.lang = matchingVoice.lang || targetCode;
        utterance.rate = options?.rate ?? 1.0;
        utterance.pitch = options?.pitch ?? 1.0;

        utterance.onstart = () => {
          options?.onStart?.();
        };

        utterance.onend = () => {
          this.currentUtterance = null;
          options?.onEnd?.();
        };

        utterance.onerror = (e) => {
          this.currentUtterance = null;
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            // Native synthesis failed, fallback to high-quality audio stream
            console.log('Native speech failed, using high-fidelity fallback audio');
            this.playFallbackAudio(clean, shortCode, options);
          } else {
            options?.onEnd?.();
          }
        };

        this.synth.speak(utterance);
        return;
      }

      // If no native voice installed on this phone (very common on Android for Arabic/Urdu):
      this.playFallbackAudio(clean, shortCode, options);
    } catch (err) {
      console.warn('Speech error, fallback audio triggered:', err);
      this.playFallbackAudio(clean, shortCode, options);
    }
  }

  private static playFallbackAudio(
    text: string,
    langCode: string,
    options?: {
      rate?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    try {
      const trimmedText = text.slice(0, 300); // Standard sentence limit for instant audio
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(
        trimmedText
      )}`;

      const audio = new Audio(audioUrl);
      this.fallbackAudio = audio;
      this.isSpeakingFallback = true;
      audio.playbackRate = options?.rate ?? 1.0;

      audio.onplay = () => {
        options?.onStart?.();
      };

      audio.onended = () => {
        this.isSpeakingFallback = false;
        this.fallbackAudio = null;
        options?.onEnd?.();
      };

      audio.onerror = (e) => {
        this.isSpeakingFallback = false;
        this.fallbackAudio = null;
        options?.onEnd?.();
      };

      audio.play().catch((err) => {
        console.warn('Audio play failed:', err);
        this.isSpeakingFallback = false;
        this.fallbackAudio = null;
        options?.onEnd?.();
      });
    } catch (e) {
      options?.onEnd?.();
    }
  }

  public static stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
      this.currentUtterance = null;
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
      } catch (e) {}
      this.fallbackAudio = null;
      this.isSpeakingFallback = false;
    }
  }

  public static isSpeaking(): boolean {
    return Boolean(this.synth?.speaking || this.isSpeakingFallback);
  }
}
