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
      
      // CRITICAL requirements: continuous = true, interimResults = true
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
          // Normal timeout if user was quiet, do not break
        } else if (event.error === 'network') {
          this.callbacks.onError('Network connection error occurred during voice recognition.');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // Auto-reconnect if user has not explicitly hit Stop, maintaining long-form recording
        if (this.shouldKeepListening) {
          try {
            this.recognition.start();
            return;
          } catch (e) {
            // Already started or restarting
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
      } catch (e) {
        // Ignored
      }
    }
    this.isListening = false;
    this.callbacks.onStateChange(false);
  }

  public getStatus(): boolean {
    return this.isListening;
  }
}

/**
 * Text-to-Speech manager using native window.speechSynthesis
 */
export class TextToSpeechManager {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
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
      }, 500);
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
    if (!this.synth) {
      options?.onError?.(new Error('Speech Synthesis not supported in this browser.'));
      return;
    }

    // Cancel any previous speech
    this.stop();

    if (!text || !text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text.trim());
    this.currentUtterance = utterance;

    const targetCode = LANGUAGES[lang].ttsCode;
    utterance.lang = targetCode;
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;

    // Pick best matching voice
    const voices = await this.getVoices();
    const matchingVoice = voices.find(
      (v) =>
        v.lang.toLowerCase() === targetCode.toLowerCase() ||
        v.lang.toLowerCase().startsWith(targetCode.split('-')[0].toLowerCase())
    );

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

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
        options?.onError?.(e);
      } else {
        options?.onEnd?.();
      }
    };

    this.synth.speak(utterance);
  }

  public static stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public static isSpeaking(): boolean {
    return Boolean(this.synth?.speaking);
  }
}
