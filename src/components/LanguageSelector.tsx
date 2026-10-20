import React from 'react';
import { ArrowLeftRight, Globe2 } from 'lucide-react';
import { LanguageCode } from '../types';
import { LANGUAGE_OPTIONS, LANGUAGES } from '../utils/languages';

interface LanguageSelectorProps {
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  onSourceChange: (lang: LanguageCode) => void;
  onTargetChange: (lang: LanguageCode) => void;
  onSwap: () => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  onSwap,
  disabled = false,
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl shadow-cyan-950/20">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Source Language */}
        <div className="flex-1 w-full">
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Source Language (بولنے کی زبان)</span>
          </label>
          <div className="relative">
            <select
              value={sourceLang}
              onChange={(e) => onSourceChange(e.target.value as LanguageCode)}
              disabled={disabled}
              className="w-full appearance-none bg-slate-800/90 border border-slate-700 hover:border-cyan-500/60 focus:border-cyan-400 text-white font-medium text-sm sm:text-base rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={`src-${lang.code}`} value={lang.code} className="bg-slate-900 text-slate-100 py-1">
                  {lang.flag} {lang.name} — {lang.nativeName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            Speech Recognition: {LANGUAGES[sourceLang].speechCode}
          </p>
        </div>

        {/* Swap Button */}
        <div className="flex items-center justify-center pt-2 sm:pt-4">
          <button
            type="button"
            onClick={onSwap}
            disabled={disabled}
            title="Swap Languages (زبانیں تبدیل کریں)"
            aria-label="Swap Languages"
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-400 hover:bg-cyan-950/40 text-cyan-400 hover:text-cyan-300 transition-all transform active:scale-90 active:rotate-180 disabled:opacity-50 disabled:cursor-not-allowed shadow-md group"
          >
            <ArrowLeftRight className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
          </button>
        </div>

        {/* Target Language */}
        <div className="flex-1 w-full">
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Target Language (ترجمے کی زبان)</span>
          </label>
          <div className="relative">
            <select
              value={targetLang}
              onChange={(e) => onTargetChange(e.target.value as LanguageCode)}
              disabled={disabled}
              className="w-full appearance-none bg-slate-800/90 border border-slate-700 hover:border-emerald-500/60 focus:border-emerald-400 text-white font-medium text-sm sm:text-base rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={`tgt-${lang.code}`} value={lang.code} className="bg-slate-900 text-slate-100 py-1">
                  {lang.flag} {lang.name} — {lang.nativeName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            NLLB Code: {LANGUAGES[targetLang].nllbCode}
          </p>
        </div>
      </div>
    </div>
  );
};
