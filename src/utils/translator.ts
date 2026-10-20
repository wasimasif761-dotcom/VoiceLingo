import { LanguageCode } from '../types';
import { LANGUAGES } from './languages';

/**
 * High-Speed Online Translation via MyMemory Public API
 */
async function fetchOnlineTranslation(
  text: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode
): Promise<string> {
  try {
    const srcCode = srcLang === 'ur-roman' ? 'ur' : srcLang;
    const tgtCode = tgtLang === 'ur-roman' ? 'ur' : tgtLang;

    // Convert Roman Urdu to standard Urdu script before sending to machine translation
    const queryText = srcLang === 'ur-roman' ? romanUrduToUrduScript(text) : text;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      queryText.trim()
    )}&langpair=${srcCode}|${tgtCode}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return '';
    const data = await res.json();

    let translated = data?.responseData?.translatedText;
    if (translated && typeof translated === 'string' && !translated.startsWith('MYMEMORY WARNING')) {
      const doc = new DOMParser().parseFromString(translated, 'text/html');
      translated = doc.body.textContent || translated;

      if (tgtLang === 'ur-roman') {
        return urduScriptToRomanUrdu(translated);
      }
      return translated;
    }
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * Primary Translation Function
 */
export async function translateText(
  text: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode,
  onStatus?: (status: string) => void
): Promise<string> {
  const clean = text.trim();
  if (!clean || srcLang === tgtLang) return clean;

  onStatus?.('Translating...');

  // 1. Direct phrasebook lookup (Fastest & 100% accurate offline)
  const directMatch = lookupPhraseDictionary(clean, srcLang, tgtLang);
  if (directMatch) {
    return directMatch;
  }

  // 2. Direct Roman Urdu <-> Urdu phonetic script conversion
  if (srcLang === 'ur-roman' && tgtLang === 'ur') {
    return romanUrduToUrduScript(clean);
  }
  if (srcLang === 'ur' && tgtLang === 'ur-roman') {
    return urduScriptToRomanUrdu(clean);
  }

  // 3. Try online translation
  if (navigator.onLine) {
    const onlineResult = await fetchOnlineTranslation(clean, srcLang, tgtLang);
    if (onlineResult && onlineResult.trim() && onlineResult.toLowerCase() !== clean.toLowerCase()) {
      return onlineResult;
    }
  }

  // 4. Offline Smart Lexicon fallback
  return fallbackSmartTranslate(clean, srcLang, tgtLang);
}

/**
 * Comprehensive Phrasebook for 100% accurate greetings and daily conversations
 */
export const PHRASE_DICTIONARY: Array<{
  en: string;
  ur: string;
  'ur-roman': string;
  ar: string;
}> = [
  {
    en: 'Hello! How are you? Hope everything will be fine.',
    ur: 'السلام علیکم! آپ کیسے ہیں؟ امید ہے سب ٹھیک ہوگا۔',
    'ur-roman': 'Assalam-o-Alaikum! Aap kaise hain? Umeed hai sab theek hoga.',
    ar: 'السلام عليكم! كيف حالك؟ أتمنى أن يكون كل شيء بخير.',
  },
  {
    en: 'Assalam-o-Alaikum! How are you? Hope you are all well.',
    ur: 'السلام علیکم! آپ کیسے ہیں؟ امید ہے سب خیریت سے ہوں گے۔',
    'ur-roman': 'Assalam-o-Alaikum! Aap kaise hain? Umeed hai sab khairiyat se honge.',
    ar: 'السلام عليكم! كيف حالكم؟ أتمنى أن تكونوا جميعاً بخير.',
  },
  {
    en: 'This VoiceLingo app is very wonderful and easy.',
    ur: 'یہ وائس لنگو ایپ بہت شاندار اور آسان ہے۔',
    'ur-roman': 'Yeh VoiceLingo app bohot shandar aur aasan hai.',
    ar: 'تطبيق VoiceLingo هذا رائع جداً وسهل الاستخدام.',
  },
  {
    en: 'I have an important meeting to attend tomorrow morning.',
    ur: 'مجھے کل صبح ایک ضروری میٹنگ میں شرکت کرنی ہے۔',
    'ur-roman': 'Mujhe kal subah ek zaroori meeting attend karni hai.',
    ar: 'لدي اجتماع مهم يجب أن أحضره صباح الغد.',
  },
  {
    en: 'Completing today’s work on time is very important.',
    ur: 'آج کا کام وقت پر مکمل کرنا بہت ضروری ہے۔',
    'ur-roman': 'Aaj ka kaam waqt par mukammal karna bohot zaroori hai.',
    ar: 'من المهم جداً إنجاز عمل اليوم في الوقت المحدد.',
  },
  {
    en: 'Can you provide me with more information about this?',
    ur: 'کیا آپ مجھے اس بارے میں مزید معلومات فراہم کر سکتے ہیں؟',
    'ur-roman': 'Kya aap mujhe is baare mein mazeed maloomat faraham kar sakte hain?',
    ar: 'هل يمكنك تزويدي بمزيد من المعلومات حول هذا الموضوع؟',
  },
  {
    en: 'Hello / Welcome',
    ur: 'السلام علیکم / خوش آمدید',
    'ur-roman': 'Assalam-o-Alaikum / Khush Amdeed',
    ar: 'السلام عليكم / أهلاً وسهلاً',
  },
  {
    en: 'Hello',
    ur: 'السلام علیکم',
    'ur-roman': 'Assalam-o-Alaikum',
    ar: 'السلام عليكم',
  },
  {
    en: 'Welcome',
    ur: 'خوش آمدید',
    'ur-roman': 'Khush Amdeed',
    ar: 'أهلاً وسهلاً',
  },
  {
    en: 'How are you?',
    ur: 'آپ کیسے ہیں؟',
    'ur-roman': 'Aap kaise hain?',
    ar: 'كيف حالك؟',
  },
  {
    en: 'How are you',
    ur: 'آپ کیسے ہیں',
    'ur-roman': 'Aap kaise hain',
    ar: 'كيف حالك',
  },
  {
    en: 'I am fine, thank you.',
    ur: 'میں ٹھیک ہوں، شکریہ۔',
    'ur-roman': 'Main theek hoon, shukriya.',
    ar: 'أنا بخير، شكراً لك.',
  },
  {
    en: 'I am fine',
    ur: 'میں ٹھیک ہوں',
    'ur-roman': 'Main theek hoon',
    ar: 'أنا بخير',
  },
  {
    en: 'Thank you very much.',
    ur: 'بہت بہت شکریہ۔',
    'ur-roman': 'Bohot bohot shukriya.',
    ar: 'شكراً جزيلاً.',
  },
  {
    en: 'Thank you',
    ur: 'شکریہ',
    'ur-roman': 'Shukriya',
    ar: 'شكراً',
  },
  {
    en: 'Please',
    ur: 'براہ کرم',
    'ur-roman': 'Barahe karam',
    ar: 'من فضلك',
  },
  {
    en: 'Yes',
    ur: 'جی ہاں',
    'ur-roman': 'Jee haan',
    ar: 'نعم',
  },
  {
    en: 'No',
    ur: 'نہیں',
    'ur-roman': 'Nahi',
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
    en: 'Goodbye',
    ur: 'اللہ حافظ',
    'ur-roman': 'Allah Hafiz',
    ar: 'مع السلامة',
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
    'ur-roman': 'Aap kahan ja rahe hain?',
    ar: 'إلى أين أنت ذاهب؟',
  },
  {
    en: 'I need help.',
    ur: 'مجھے مدد کی ضرورت ہے۔',
    'ur-roman': 'Mujhe madad ki zaroorat hai.',
    ar: 'أحتاج إلى مساعدة.',
  },
  {
    en: 'Congratulations!',
    ur: 'مبارک ہو!',
    'ur-roman': 'Mubarak ho!',
    ar: 'مبروك!',
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
    en: 'I love you.',
    ur: 'میں آپ سے محبت کرتا ہوں۔',
    'ur-roman': 'Main aap se mohabbat karta hoon.',
    ar: 'أنا أحبك.',
  },
  {
    en: 'Call me when you are free.',
    ur: 'جب آپ فارغ ہوں تو مجھے کال کریں۔',
    'ur-roman': 'Jab aap farigh hon to mujhe call karain.',
    ar: 'اتصل بي عندما تكون متفرغاً.',
  },
  {
    en: 'Have a safe journey.',
    ur: 'آپ کا سفر محفوظ رہے۔',
    'ur-roman': 'Aap ka safar mehfooz rahe.',
    ar: 'رحلة سعيدة وآمنة.',
  },
  {
    en: 'What are you doing?',
    ur: 'آپ کیا کر رہے ہیں؟',
    'ur-roman': 'Aap kya kar rahe hain?',
    ar: 'ماذا تفعل؟',
  },
  {
    en: 'Where do you live?',
    ur: 'آپ کہاں رہتے ہیں؟',
    'ur-roman': 'Aap kahan rehte hain?',
    ar: 'أين تعيش؟',
  },
  {
    en: 'I am learning new languages with VoiceLingo.',
    ur: 'میں وائس لنگو سے نئی زبانیں سیکھ رہا ہوں۔',
    'ur-roman': 'Main VoiceLingo se nayi zabanain seekh raha hoon.',
    ar: 'أنا أتعلم لغات جديدة عبر فويس لينغو.',
  },
  {
    en: 'Peace be upon you',
    ur: 'السلام علیکم',
    'ur-roman': 'Assalam-o-Alaikum',
    ar: 'السلام عليكم ورحمة الله',
  },
  {
    en: 'Inshallah',
    ur: 'انشاء اللہ',
    'ur-roman': 'Inshallah',
    ar: 'إن شاء الله',
  },
  {
    en: 'Alhamdulillah',
    ur: 'الحمد للہ',
    'ur-roman': 'Alhamdulillah',
    ar: 'الحمد لله',
  },
];

function lookupPhraseDictionary(text: string, srcLang: LanguageCode, tgtLang: LanguageCode): string | null {
  const clean = text.trim().toLowerCase().replace(/[.,!?،؟]/g, '');

  for (const item of PHRASE_DICTIONARY) {
    const srcVal = item[srcLang]?.toLowerCase().replace(/[.,!?،؟]/g, '');
    if (srcVal && (clean === srcVal || clean === srcVal.trim())) {
      return item[tgtLang];
    }
  }
  return null;
}

/**
 * Word vocabulary for tokenized fallback
 */
const VOCABULARY: Record<string, { ur: string; 'ur-roman': string; ar: string; en: string }> = {
  water: { en: 'water', ur: 'پانی', 'ur-roman': 'paani', ar: 'ماء' },
  food: { en: 'food', ur: 'کھانا', 'ur-roman': 'khana', ar: 'طعام' },
  home: { en: 'home', ur: 'گھر', 'ur-roman': 'ghar', ar: 'منزل' },
  house: { en: 'house', ur: 'گھر', 'ur-roman': 'ghar', ar: 'بيت' },
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
  love: { en: 'love', ur: 'محبت', 'ur-roman': 'mohabbat', ar: 'حب' },
  brother: { en: 'brother', ur: 'بھائی', 'ur-roman': 'bhai', ar: 'أخ' },
  sister: { en: 'sister', ur: 'بہن', 'ur-roman': 'behan', ar: 'أخت' },
  father: { en: 'father', ur: 'والد', 'ur-roman': 'walid', ar: 'أب' },
  mother: { en: 'mother', ur: 'والدہ', 'ur-roman': 'walida', ar: 'أم' },
  city: { en: 'city', ur: 'شہر', 'ur-roman': 'shehar', ar: 'مدينة' },
  country: { en: 'country', ur: 'ملک', 'ur-roman': 'mulk', ar: 'بلد' },
  good: { en: 'good', ur: 'اچھا', 'ur-roman': 'acha', ar: 'جيد' },
  bad: { en: 'bad', ur: 'برا', 'ur-roman': 'bura', ar: 'سيء' },
  big: { en: 'big', ur: 'بڑا', 'ur-roman': 'bada', ar: 'كبير' },
  small: { en: 'small', ur: 'چھوٹا', 'ur-roman': 'chota', ar: 'صغير' },
  night: { en: 'night', ur: 'رات', 'ur-roman': 'raat', ar: 'ليل' },
  day: { en: 'day', ur: 'دن', 'ur-roman': 'din', ar: 'نهار' },
  morning: { en: 'morning', ur: 'صبح', 'ur-roman': 'subah', ar: 'صباح' },
  evening: { en: 'evening', ur: 'شام', 'ur-roman': 'shaam', ar: 'مساء' },
  easy: { en: 'easy', ur: 'آسان', 'ur-roman': 'aasan', ar: 'سهل' },
  wonderful: { en: 'wonderful', ur: 'شاندار', 'ur-roman': 'shandar', ar: 'رائع' },
  great: { en: 'great', ur: 'شاندار', 'ur-roman': 'shandar', ar: 'عظيم' },
  important: { en: 'important', ur: 'ضروری', 'ur-roman': 'zaroori', ar: 'مهم' },
  meeting: { en: 'meeting', ur: 'میٹنگ', 'ur-roman': 'meeting', ar: 'اجتماع' },
};

/**
 * Smart fallback translation with phrase matching, token replacement
 */
export function fallbackSmartTranslate(
  text: string,
  srcLang: LanguageCode,
  tgtLang: LanguageCode
): string {
  const clean = text.trim();
  if (!clean || srcLang === tgtLang) return clean;

  const phraseMatch = lookupPhraseDictionary(clean, srcLang, tgtLang);
  if (phraseMatch) return phraseMatch;

  if (srcLang === 'ur-roman' && tgtLang === 'ur') {
    return romanUrduToUrduScript(clean);
  }
  if (srcLang === 'ur' && tgtLang === 'ur-roman') {
    return urduScriptToRomanUrdu(clean);
  }

  // Tokenized translation attempt
  const words = clean.split(/(\s+|[.,!?،؟])/);
  let translatedWords = words.map((w) => {
    const stripped = w.toLowerCase().trim();
    if (!stripped) return w;

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

  return clean;
}

/**
 * Robust Multi-word and Single-word Roman Urdu to Pure Urdu Script Converter
 */
export function romanUrduToUrduScript(roman: string): string {
  let s = roman;

  // 1. Compound Phrases first
  const phraseRules: Array<[RegExp, string]> = [
    [/assalam[- ]?o[- ]?alaikum[!.]?/gi, 'السلام علیکم'],
    [/asalam[- ]?o[- ]?alaikum[!.]?/gi, 'السلام علیکم'],
    [/salam[- ]?o[- ]?alaikum[!.]?/gi, 'السلام علیکم'],
    [/aap kaise hain\??/gi, 'آپ کیسے ہیں؟'],
    [/ap kaise hain\??/gi, 'آپ کیسے ہیں؟'],
    [/ap kese ho\??/gi, 'آپ کیسے ہو؟'],
    [/aap kese ho\??/gi, 'آپ کیسے ہو؟'],
    [/kya haal hai\??/gi, 'کیا حال ہے؟'],
    [/umeed hai sab theek hoga[!.]?/gi, 'امید ہے سب ٹھیک ہوگا۔'],
    [/umeed hai sb theek hoga[!.]?/gi, 'امید ہے سب ٹھیک ہوگا۔'],
    [/umeed hai sab theek honge[!.]?/gi, 'امید ہے سب ٹھیک ہوں گے۔'],
    [/umeed hai sab khairiyat se honge[!.]?/gi, 'امید ہے سب خیریت سے ہوں گے۔'],
    [/yeh voicelingo app bohot shandar aur aasan hai[!.]?/gi, 'یہ وائس لنگو ایپ بہت شاندار اور آسان ہے۔'],
    [/bohot shandar aur aasan/gi, 'بہت شاندار اور آسان'],
    [/bohat shandar aur aasan/gi, 'بہت شاندار اور آسان'],
    [/shandar aur aasan/gi, 'شاندار اور آسان'],
    [/allah[- ]?hafiz[!.]?/gi, 'اللہ حافظ'],
    [/subah bakhair[!.]?/gi, 'صبح بخیر'],
    [/shaam bakhair[!.]?/gi, 'شام بخیر'],
    [/shab bakhair[!.]?/gi, 'شب بخیر'],
    [/khush amdeed[!.]?/gi, 'خوش آمدید'],
    [/bohot bohot shukriya[!.]?/gi, 'بہت بہت شکریہ'],
    [/meeting attend karni hai/gi, 'میٹنگ میں شرکت کرنی ہے'],
    [/attend karni hai/gi, 'شرکت کرنی ہے'],
    [/zaroori meeting/gi, 'ضروری میٹنگ'],
    [/kal subah/gi, 'کل صبح'],
    [/aaj ka kaam/gi, 'آج کا کام'],
    [/waqt par mukammal karna/gi, 'وقت پر مکمل کرنا'],
    [/bohot zaroori hai/gi, 'بہت ضروری ہے'],
    [/mazeed maloomat/gi, 'مزید معلومات'],
    [/faraham kar sakte hain/gi, 'فراہم کر سکتے ہیں'],
  ];

  for (const [pattern, replacement] of phraseRules) {
    s = s.replace(pattern, replacement);
  }

  // 2. Word-by-word mapping
  const wordMap: Record<string, string> = {
    'assalam': 'السلام',
    'alaikum': 'علیکم',
    'shukriya': 'شکریہ',
    'shandar': 'شاندار',
    'aasan': 'آسان',
    'asan': 'آسان',
    'bohot': 'بہت',
    'bohat': 'بہت',
    'bht': 'بہت',
    'umeed': 'امید',
    'sab': 'سب',
    'sb': 'سب',
    'theek': 'ٹھیک',
    'thik': 'ٹھیک',
    'hoga': 'ہوگا',
    'hogi': 'ہوگی',
    'honge': 'ہوں گے',
    'hai': 'ہے',
    'hain': 'ہیں',
    'hoon': 'ہوں',
    'ho': 'ہو',
    'yeh': 'یہ',
    'ye': 'یہ',
    'woh': 'وہ',
    'wo': 'وہ',
    'aap': 'آپ',
    'ap': 'آپ',
    'tum': 'تم',
    'main': 'میں',
    'hum': 'ہم',
    'kaise': 'کیسے',
    'kaisa': 'کیسا',
    'kaisi': 'کیسی',
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
    'nahin': 'نہیں',
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
    'zaroori': 'ضروری',
    'meeting': 'میٹنگ',
    'app': 'ایپ',
    'voicelingo': 'وائس لنگو',
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
    'kar': 'کر',
    'jao': 'جاؤ',
    'aao': 'آؤ',
    'baat': 'بات',
    'waqt': 'وقت',
    'aur': 'اور',
    'par': 'پر',
    'pe': 'پر',
    'se': 'سے',
    'ko': 'کو',
    'ki': 'کی',
    'ka': 'کا',
    'ke': 'کے',
    'ek': 'ایک',
    'do': 'دو',
    'teen': 'تین',
    'char': 'چار',
    'paanch': 'پانچ',
  };

  // Replace words that match wordMap
  const tokens = s.split(/(\s+|[.,!?،؟])/);
  const mappedTokens = tokens.map((t) => {
    const low = t.toLowerCase().trim();
    return wordMap[low] || t;
  });

  return mappedTokens.join('');
}

/**
 * Phonetic mapper for Urdu Script to Roman Urdu
 */
export function urduScriptToRomanUrdu(urdu: string): string {
  const map: Record<string, string> = {
    'السلام علیکم': 'Assalam-o-Alaikum',
    'شکریہ': 'Shukriya',
    'کیسے': 'kaise',
    'کیسا': 'kaisa',
    'ہیں': 'hain',
    'ہوں': 'hoon',
    'ہے': 'hai',
    'آپ': 'aap',
    'تم': 'tum',
    'میں': 'main',
    'ہم': 'hum',
    'ٹھیک': 'theek',
    'بہت': 'bohot',
    'اچھا': 'acha',
    'کیا': 'kya',
    'کیوں': 'kyun',
    'کہاں': 'kahan',
    'کب': 'kab',
    'کون': 'kaun',
    'ہاں': 'haan',
    'نہیں': 'nahi',
    'کل': 'kal',
    'آج': 'aaj',
    'رات': 'raat',
    'دن': 'din',
    'صبح': 'subah',
    'شام': 'shaam',
    'دوست': 'dost',
    'گھر': 'ghar',
    'کام': 'kaam',
    'پانی': 'paani',
    'کھانا': 'khana',
    'اللہ حافظ': 'Allah Hafiz',
    'مدد': 'madad',
    'ضرورت': 'zaroorat',
    'شاندار': 'shandar',
    'آسان': 'aasan',
    'نام': 'naam',
    'میرا': 'mera',
    'میری': 'meri',
    'وقت': 'waqt',
  };

  let res = urdu;
  for (const [key, val] of Object.entries(map)) {
    res = res.replaceAll(key, val);
  }
  return res;
}
