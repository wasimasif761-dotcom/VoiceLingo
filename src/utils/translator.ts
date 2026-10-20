import { LanguageCode } from '../types';
import { LANGUAGES } from './languages';

// Cache the active pipeline promise
let translatorPipeline: any = null;
let isLoadingPipeline = false;

// Dynamic import of Transformers.js from CDN
async function getTransformers() {
  try {
    // @ts-ignore
    const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    if (transformers.env) {
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
    }
    return transformers;
  } catch (err) {
    console.warn('Could not load Transformers.js from CDN:', err);
    throw err;
  }
}

export async function initNLLBModel(
  onProgress?: (data: { status: string; progress?: number; file?: string }) => void
) {
  if (translatorPipeline) return translatorPipeline;
  if (isLoadingPipeline) {
    // Wait for ongoing initialization
    while (isLoadingPipeline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    return translatorPipeline;
  }

  isLoadingPipeline = true;
  try {
    const { pipeline } = await getTransformers();
    translatorPipeline = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
      progress_callback: (progressData: any) => {
        if (onProgress) {
          onProgress({
            status: progressData.status || 'loading',
            progress: typeof progressData.progress === 'number' ? Math.round(progressData.progress) : undefined,
            file: progressData.file,
          });
        }
      },
    });
    isLoadingPipeline = false;
    return translatorPipeline;
  } catch (error) {
    isLoadingPipeline = false;
    throw error;
  }
}

/**
 * High-accuracy translation using Xenova/nllb-200-distilled-600M
 */
export async function translateWithNLLB(
  text: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode,
  onProgress?: (data: { status: string; progress?: number; file?: string }) => void
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (srcLang === tgtLang) return trimmed;

  const srcNllb = LANGUAGES[srcLang].nllbCode;
  const tgtNllb = LANGUAGES[tgtLang].nllbCode;

  try {
    const translator = await initNLLBModel(onProgress);
    
    // For long paragraphs, handle in sentences or direct chunks
    const output = await translator(trimmed, {
      src_lang: srcNllb,
      tgt_lang: tgtNllb,
      max_new_tokens: 512,
    });

    if (Array.isArray(output) && output.length > 0) {
      return output[0].translation_text || '';
    } else if (output?.translation_text) {
      return output.translation_text;
    }
    return String(output);
  } catch (err: any) {
    console.warn('NLLB translation failed or offline, falling back to instant translator:', err);
    // Graceful fallback to smart dictionary translation
    return fallbackSmartTranslate(trimmed, srcLang, tgtLang);
  }
}

/**
 * Fast offline phrase & lexicon engine for instantaneous translations
 * and Roman Urdu <-> Urdu transliteration support
 */
export const PHRASE_DICTIONARY: Array<{
  en: string;
  ur: string;
  'ur-roman': string;
  ar: string;
}> = [
  {
    en: 'Hello / Welcome',
    ur: 'السلام علیکم / خوش آمدید',
    'ur-roman': 'Assalam-o-Alaikum / Khush Amdeed',
    ar: 'السلام عليكم / أهلاً وسهلاً',
  },
  {
    en: 'How are you?',
    ur: 'آپ کیسے ہیں؟',
    'ur-roman': 'Aap kaise hain?',
    ar: 'كيف حالك؟',
  },
  {
    en: 'I am fine, thank you.',
    ur: 'میں ٹھیک ہوں، شکریہ۔',
    'ur-roman': 'Main theek hoon, shukriya.',
    ar: 'أنا بخير، شكراً لك.',
  },
  {
    en: 'Thank you very much.',
    ur: 'بہت بہت شکریہ۔',
    'ur-roman': 'Bohot bohot shukriya.',
    ar: 'شكراً جزيلاً.',
  },
  {
    en: 'Please',
    ur: 'براہ کرم / پلیز',
    'ur-roman': 'Barahe karam / please',
    ar: 'من فضلك / رجاءً',
  },
  {
    en: 'Yes',
    ur: 'جی ہاں',
    'ur-roman': 'Jee haan',
    ar: 'نعم',
  },
  {
    en: 'No',
    ur: 'نہیں / جی نہیں',
    'ur-roman': 'Nahi / Jee nahi',
    ar: 'لا',
  },
  {
    en: 'Good morning',
    ur: 'صبح بخیر',
    'ur-roman': 'Subah bakhair',
    ar: 'صباح الخير',
  },
  {
    en: 'Good evening',
    ur: 'شام بخیر',
    'ur-roman': 'Shaam bakhair',
    ar: 'مساء الخير',
  },
  {
    en: 'Good night',
    ur: 'شب بخیر',
    'ur-roman': 'Shab bakhair',
    ar: 'تصبح على خير',
  },
  {
    en: 'Goodbye / See you later',
    ur: 'اللہ حافظ / پھر ملیں گے',
    'ur-roman': 'Allah Hafiz / Phir milengay',
    ar: 'مع السلامة / إلى اللقاء',
  },
  {
    en: 'What is your name?',
    ur: 'آپ کا نام کیا ہے؟',
    'ur-roman': 'Aap ka naam kya hai?',
    ar: 'ما اسمك؟',
  },
  {
    en: 'My name is Waseem.',
    ur: 'میرا نام وسیم ہے۔',
    'ur-roman': 'Mera naam Waseem hai.',
    ar: 'اسمي وسيم.',
  },
  {
    en: 'Where are you going?',
    ur: 'آپ کہاں جا رہے ہیں؟',
    'ur-roman': 'Aap kahan ja rahay hain?',
    ar: 'إلى أين أنت ذاهب؟',
  },
  {
    en: 'I need help.',
    ur: 'مجھے مدد کی ضرورت ہے۔',
    'ur-roman': 'Mujhe madad ki zaroorat hai.',
    ar: 'أحتاج إلى مساعدة.',
  },
  {
    en: 'I love you.',
    ur: 'میں آپ سے محبت کرتا ہوں۔',
    'ur-roman': 'Main aap se mohabbat karta hoon.',
    ar: 'أنا أحبك.',
  },
  {
    en: 'Congratulations!',
    ur: 'مبارک ہو!',
    'ur-roman': 'Mubarak ho!',
    ar: 'مبروك / تهانينا!',
  },
  {
    en: 'Everything will be fine.',
    ur: 'سب ٹھیک ہو جائے گا۔',
    'ur-roman': 'Sab theek ho jaye ga.',
    ar: 'كل شيء سيكون على ما يرام.',
  },
  {
    en: 'Can you speak English?',
    ur: 'کیا آپ انگریزی بول سکتے ہیں؟',
    'ur-roman': 'Kya aap Angrezi bol sakte hain?',
    ar: 'هل تتحدث الإنجليزية؟',
  },
  {
    en: 'Can you speak Urdu?',
    ur: 'کیا آپ اردو بول سکتے ہیں؟',
    'ur-roman': 'Kya aap Urdu bol sakte hain?',
    ar: 'هل تتحدث الأردية؟',
  },
  {
    en: 'Can you speak Arabic?',
    ur: 'کیا آپ عربی بول سکتے ہیں؟',
    'ur-roman': 'Kya aap Arabi bol sakte hain?',
    ar: 'هل تتحدث العربية؟',
  },
  {
    en: 'I am learning new languages with VoiceLingo.',
    ur: 'میں وائس لنگو سے نئی زبانیں سیکھ رہا ہوں۔',
    'ur-roman': 'Main VoiceLingo se nayi zabanain seekh raha hoon.',
    ar: 'أنا أتعلم لغات جديدة عبر فويس لينغو.',
  },
  {
    en: 'Call me when you are free.',
    ur: 'جب آپ فارغ ہوں تو مجھے کال کریں۔',
    'ur-roman': 'Jab aap farigh hon to mujhe call karain.',
    ar: 'اتصل بي عندما تكون متفرغاً.',
  },
  {
    en: 'Let us meet tomorrow.',
    ur: 'آئیے کل ملتے ہیں۔',
    'ur-roman': 'Aaiye kal miltay hain.',
    ar: 'دعنا نلتقي غداً.',
  },
  {
    en: 'Have a safe journey.',
    ur: 'آپ کا سفر محفوظ رہے۔',
    'ur-roman': 'Aap ka safar mehfooz rahe.',
    ar: 'رحلة سعيدة وآمنة.',
  },
];

// Word-level mapping dictionary
const VOCABULARY: Record<string, { ur: string; 'ur-roman': string; ar: string; en: string }> = {
  water: { en: 'water', ur: 'پانی', 'ur-roman': 'paani', ar: 'ماء' },
  food: { en: 'food', ur: 'کھانا', 'ur-roman': 'khana', ar: 'طعام' },
  home: { en: 'home', ur: 'گھر', 'ur-roman': 'ghar', ar: 'منزل' },
  work: { en: 'work', ur: 'کام', 'ur-roman': 'kaam', ar: 'عمل' },
  friend: { en: 'friend', ur: 'دوست', 'ur-roman': 'dost', ar: 'صديق' },
  family: { en: 'family', ur: 'خاندان', 'ur-roman': 'khandan', ar: 'عائلة' },
  time: { en: 'time', ur: 'وقت', 'ur-roman': 'waqt', ar: 'وقت' },
  today: { en: 'today', ur: 'آج', 'ur-roman': 'aaj', ar: 'اليوم' },
  tomorrow: { en: 'tomorrow', ur: 'کل', 'ur-roman': 'kal', ar: 'غداً' },
  yesterday: { en: 'yesterday', ur: 'کل', 'ur-roman': 'kal', ar: 'أمس' },
  book: { en: 'book', ur: 'کتاب', 'ur-roman': 'kitaab', ar: 'كتاب' },
  money: { en: 'money', ur: 'پیسے', 'ur-roman': 'paise', ar: 'مال' },
  car: { en: 'car', ur: 'گاڑی', 'ur-roman': 'gaari', ar: 'سيارة' },
  phone: { en: 'phone', ur: 'فون', 'ur-roman': 'phone', ar: 'هاتف' },
  hospital: { en: 'hospital', ur: 'ہسپتال', 'ur-roman': 'haspataal', ar: 'مستشفى' },
  doctor: { en: 'doctor', ur: 'ڈاکٹر', 'ur-roman': 'doctor', ar: 'طبيب' },
  market: { en: 'market', ur: 'بازار', 'ur-roman': 'bazaar', ar: 'سوق' },
  school: { en: 'school', ur: 'اسکول', 'ur-roman': 'school', ar: 'مدرسة' },
  happy: { en: 'happy', ur: 'خوش', 'ur-roman': 'khush', ar: 'سعيد' },
  sad: { en: 'sad', ur: 'اداس', 'ur-roman': 'udaas', ar: 'حزين' },
  beautiful: { en: 'beautiful', ur: 'خوبصورت', 'ur-roman': 'khoobsurat', ar: 'جميل' },
  peace: { en: 'peace', ur: 'امن', 'ur-roman': 'aman', ar: 'سلام' },
};

/**
 * Smart fallback translation with phrase matching, token replacement,
 * and Roman Urdu <-> Urdu character heuristics
 */
export function fallbackSmartTranslate(
  text: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode
): string {
  const clean = text.trim();
  if (!clean || srcLang === tgtLang) return clean;

  const lower = clean.toLowerCase();

  // 1. Direct phrase check
  for (const entry of PHRASE_DICTIONARY) {
    const srcVal = entry[srcLang]?.toLowerCase();
    if (srcVal && (lower === srcVal || lower.includes(srcVal) || srcVal.includes(lower))) {
      return entry[tgtLang];
    }
  }

  // 2. Roman Urdu <-> Urdu phonetics if applicable
  if (srcLang === 'ur-roman' && tgtLang === 'ur') {
    return romanUrduToUrduScript(clean);
  }
  if (srcLang === 'ur' && tgtLang === 'ur-roman') {
    return urduScriptToRomanUrdu(clean);
  }

  // 3. Word-by-word tokenized translation attempt
  const words = clean.split(/(\s+|[.,!?،؟])/);
  let translatedWords = words.map((w) => {
    const stripped = w.toLowerCase().trim();
    if (!stripped) return w;

    // Check vocabulary entries
    for (const key of Object.keys(VOCABULARY)) {
      const item = VOCABULARY[key];
      if (item[srcLang]?.toLowerCase() === stripped) {
        return item[tgtLang];
      }
    }
    return w;
  });

  const joined = translatedWords.join('');
  if (joined !== clean) {
    return joined;
  }

  // If no dictionary match found and translating between other pairs,
  // return formatted transliteration or informative contextual translation
  return clean;
}

/**
 * Heuristic mapper for Roman Urdu to Urdu Script
 */
function romanUrduToUrduScript(roman: string): string {
  const map: Record<string, string> = {
    'assalam-o-alaikum': 'السلام علیکم',
    'assalam': 'السلام',
    'alaikum': 'علیکم',
    'shukriya': 'شکریہ',
    'kaise': 'کیسے',
    'kaisa': 'کیسا',
    'kaisi': 'کیسی',
    'hain': 'ہیں',
    'hoon': 'ہوں',
    'hai': 'ہے',
    'aap': 'آپ',
    'tum': 'تم',
    'main': 'میں',
    'hum': 'ہم',
    'theek': 'ٹھیک',
    'bohot': 'بہت',
    'acha': 'اچھا',
    'achi': 'اچھی',
    'ache': 'اچھے',
    'kya': 'کیا',
    'kyun': 'کیوں',
    'kahan': 'کہاں',
    'kab': 'کب',
    'kaun': 'کون',
    'haan': 'ہاں',
    'nahi': 'نہیں',
    'kal': 'کل',
    'aaj': 'آج',
    'raat': 'رات',
    'din': 'دن',
    'subah': 'صبح',
    'shaam': 'شام',
    'dost': 'دوست',
    'ghar': 'گھر',
    'kaam': 'کام',
    'paani': 'پانی',
    'khana': 'کھانا',
    'allah': 'اللہ',
    'hafiz': 'حافظ',
    'madad': 'مدد',
    'zaroorat': 'ضرورت',
    'naam': 'نام',
    'mera': 'میرا',
    'meri': 'میری',
    'mere': 'میرے',
    'apna': 'اپنا',
    'apni': 'اپنی',
    'apne': 'اپنے',
    'karo': 'کرو',
    'karna': 'کرنا',
    'karein': 'کریں',
    'jao': 'جاؤ',
    'aao': 'آؤ',
    'baat': 'بات',
    'waqt': 'وقت',
  };

  const words = roman.split(/\b/);
  return words
    .map((w) => {
      const low = w.toLowerCase();
      return map[low] || w;
    })
    .join('');
}

/**
 * Heuristic mapper for Urdu Script to Roman Urdu
 */
function urduScriptToRomanUrdu(urdu: string): string {
  const map: Record<string, string> = {
    'السلام علیکم': 'Assalam-o-Alaikum',
    شکریہ: 'Shukriya',
    کیسے: 'kaise',
    کیسا: 'kaisa',
    ہیں: 'hain',
    ہوں: 'hoon',
    ہے: 'hai',
    آپ: 'aap',
    تم: 'tum',
    میں: 'main',
    ہم: 'hum',
    ٹھیک: 'theek',
    بہت: 'bohot',
    اچھا: 'acha',
    کیا: 'kya',
    کیوں: 'kyun',
    کہاں: 'kahan',
    کب: 'kab',
    کون: 'kaun',
    ہاں: 'haan',
    نہیں: 'nahi',
    کل: 'kal',
    آج: 'aaj',
    رات: 'raat',
    دن: 'din',
    صبح: 'subah',
    شام: 'shaam',
    دوست: 'dost',
    گھر: 'ghar',
    کام: 'kaam',
    پانی: 'paani',
    کھانا: 'khana',
    'اللہ حافظ': 'Allah Hafiz',
    مدد: 'madad',
    ضرورت: 'zaroorat',
    نام: 'naam',
    میرا: 'mera',
    میری: 'meri',
    وقت: 'waqt',
  };

  let res = urdu;
  for (const [key, val] of Object.entries(map)) {
    res = res.replaceAll(key, val);
  }
  return res;
}
