export type LanguageCode = 'ur' | 'ur-roman' | 'en' | 'ar';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  nllbCode: string;
  speechCode: string;
  ttsCode: string;
  isRtl: boolean;
  fontClass: string;
  flag: string;
  placeholder: string;
}

export interface NoteItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  createdAt: number;
  isFavorite?: boolean;
  hasAudio?: boolean;
}

export type TranslationEngine = 'nllb' | 'instant';

export interface TranslationProgress {
  status: 'idle' | 'loading-model' | 'translating' | 'ready' | 'error';
  progress?: number; // 0-100
  statusText?: string;
  error?: string;
}

export interface AudioRecordingData {
  blob: Blob | null;
  url: string | null;
  duration: number;
}
