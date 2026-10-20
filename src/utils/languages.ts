import { LanguageCode, LanguageInfo } from '../types';

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  ur: {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    nllbCode: 'urd_Arab',
    speechCode: 'ur-PK',
    ttsCode: 'ur-PK',
    isRtl: true,
    fontClass: 'font-urdu',
    flag: '🇵🇰',
    placeholder: 'یہاں بولیں یا اردو میں لکھیں...',
  },
  'ur-roman': {
    code: 'ur-roman',
    name: 'Roman Urdu',
    nativeName: 'Roman Urdu',
    nllbCode: 'urd_Latn',
    speechCode: 'en-US',
    ttsCode: 'en-IN',
    isRtl: false,
    fontClass: 'font-latin',
    flag: '🔤',
    placeholder: 'Yahan bolain ya Roman Urdu me type karain...',
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    nllbCode: 'eng_Latn',
    speechCode: 'en-US',
    ttsCode: 'en-US',
    isRtl: false,
    fontClass: 'font-latin',
    flag: '🇬🇧',
    placeholder: 'Speak or type your English notes here...',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    nllbCode: 'arb_Arab',
    speechCode: 'ar-SA',
    ttsCode: 'ar-SA',
    isRtl: true,
    fontClass: 'font-arabic',
    flag: '🇸🇦',
    placeholder: 'تحدث أو اكتب ملاحظاتك باللغة العربية هنا...',
  },
};

export const LANGUAGE_OPTIONS: LanguageInfo[] = Object.values(LANGUAGES);

export const SAMPLE_PROMPTS: Record<LanguageCode, string[]> = {
  ur: [
    'السلام علیکم! آپ کیسے ہیں؟ امید ہے سب خیریت سے ہوں گے۔',
    'آج کا کام وقت پر مکمل کرنا بہت ضروری ہے۔',
    'کیا آپ مجھے اس بارے میں مزید معلومات فراہم کر سکتے ہیں؟',
  ],
  'ur-roman': [
    'Assalam-o-Alaikum! Aap kaise hain? Umeed hai sab theek hoga.',
    'Mujhe kal subah ek zaroori meeting attend karni hai.',
    'Yeh VoiceLingo app bohot shandar aur aasan hai.',
  ],
  en: [
    'Hello and welcome! How can I assist you today?',
    'Remember to send the project documentation before Friday afternoon.',
    'VoiceLingo makes multilingual voice translation effortless.',
  ],
  ar: [
    'السلام عليكم ورحمة الله وبركاته، كيف حالك اليوم؟',
    'أتمنى لك يوماً سعيداً ومليئاً بالنجاح والتوفيق.',
    'شكراً جزيلاً على المساعدة القيمة التي قدمتها لي.',
  ],
};
