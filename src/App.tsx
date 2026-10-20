/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  ArrowRight,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Share2,
  RotateCcw,
  Sparkles,
  WifiOff,
  MessageCircle,
  HelpCircle,
  CheckCircle2,
  Download,
  Play,
  Square,
  Radio,
  Sliders,
} from 'lucide-react';
import { LanguageCode, NoteItem, TranslationProgress } from './types';
import { LANGUAGES, SAMPLE_PROMPTS } from './utils/languages';
import { translateText } from './utils/translator';
import { VoiceRecognitionManager, TextToSpeechManager } from './utils/speech';
import { AudioRecordingService } from './utils/audioRecorder';
import {
  AUTHOR_NAME,
  AUTHOR_EMAIL,
  shareTextOnWhatsApp,
  shareWebsiteOnWhatsApp,
} from './utils/whatsapp';

import { LanguageSelector } from './components/LanguageSelector';
import { AudioVisualizer } from './components/AudioVisualizer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ShareModal } from './components/ShareModal';
import { FeedbackModal } from './components/FeedbackModal';
import { NotesHistory } from './components/NotesHistory';

export default function App() {
  // State
  const [sourceLang, setSourceLang] = useState<LanguageCode>('ur');
  const [targetLang, setTargetLang] = useState<LanguageCode>('en');

  const [sourceText, setSourceText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  // Audio & Speech state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isSpeakingSource, setIsSpeakingSource] = useState(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Recorded Audio for playback & WhatsApp share
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState(false);

  // Translation state
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress>({
    status: 'idle',
  });

  // UI feedback & modals
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  // Offline status
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Notes History
  const [notes, setNotes] = useState<NoteItem[]>([]);

  // Services refs
  const voiceRecognitionRef = useRef<VoiceRecognitionManager | null>(null);
  const audioRecorderRef = useRef<AudioRecordingService>(new AudioRecordingService());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load notes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('voicelingo_history');
      if (stored) {
        setNotes(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load notes history from localStorage:', e);
    }
  }, []);

  // Save notes to localStorage whenever updated
  const saveNotes = (updated: NoteItem[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('voicelingo_history', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save notes to localStorage:', e);
    }
  };

  // Helper notification toast
  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Initialize VoiceRecognitionManager
  useEffect(() => {
    const manager = new VoiceRecognitionManager({
      onTranscript: (finalText, liveInterim) => {
        setSourceText(finalText);
        setInterimText(liveInterim);
      },
      onError: (errorMsg) => {
        showToast(errorMsg, 'error');
        setIsRecording(false);
      },
      onStateChange: (listening) => {
        setIsRecording(listening);
        if (!listening) {
          setInterimText('');
        }
      },
    });

    voiceRecognitionRef.current = manager;

    return () => {
      manager.stop();
      TextToSpeechManager.stop();
    };
  }, []);

  // Keep SpeechRecognition in sync with source language
  useEffect(() => {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.setLanguage(sourceLang);
    }
  }, [sourceLang]);

  // Sync initial transcript if user types manually
  useEffect(() => {
    if (voiceRecognitionRef.current && !isRecording) {
      voiceRecognitionRef.current.setInitialTranscript(sourceText);
    }
  }, [sourceText, isRecording]);

  const recordingTimerRef = useRef<any>(null);

  // Handle Start Recording (continuous speech-to-text)
  const handleStartRecording = () => {
    try {
      // Clear interim
      setInterimText('');
      setRecordingSeconds(0);

      // Start recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // 1. Start SpeechRecognition SYNCHRONOUSLY within direct user tap
      if (voiceRecognitionRef.current) {
        if (!voiceRecognitionRef.current.isSupported()) {
          showToast('براؤزر میں وائس ریکگنیشن سپورٹڈ نہیں ہے۔ Google Chrome استعمال کریں (Use Google Chrome)', 'error');
          return;
        }
        voiceRecognitionRef.current.setInitialTranscript(sourceText);
        voiceRecognitionRef.current.start(sourceLang);
      }
      setIsRecording(true);
      showToast('سن رہا ہے... بولنا شروع کریں (' + LANGUAGES[sourceLang].name + ')', 'info');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Microphone error', 'error');
      setIsRecording(false);
    }
  };

  // Handle Stop Recording
  const handleStopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
    }
    setAnalyser(null);
    setIsRecording(false);
    setInterimText('');
    showToast('آواز محفوظ ہو گئی! اب ترجمہ کریں (Voice captured! Ready to translate)', 'success');
  };

  // Language Swap
  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  // Translate Action
  const handleTranslate = async () => {
    let textToTranslate = sourceText.trim();
    if (isRecording) {
      if (interimText.trim()) {
        textToTranslate = (textToTranslate ? `${textToTranslate} ${interimText.trim()}` : interimText.trim()).trim();
        setSourceText(textToTranslate);
      }
      handleStopRecording();
    }

    if (!textToTranslate) {
      showToast('پہلے بولیں یا کوئی ٹیکسٹ لکھیں تاکہ ترجمہ ہو سکے (Speak or type text first)', 'info');
      return;
    }

    if (sourceLang === targetLang) {
      setTranslatedText(textToTranslate);
      return;
    }

    setTranslationProgress({
      status: 'translating',
      statusText: 'Translating...',
    });

    try {
      const finalResult = await translateText(
        textToTranslate,
        sourceLang,
        targetLang,
        (statusText) => setTranslationProgress({ status: 'translating', statusText })
      );

      const resolved = finalResult || textToTranslate;
      setTranslatedText(resolved);
      setTranslationProgress({ status: 'ready', statusText: 'Translation complete!' });

      // Save to Notes History
      const newNote: NoteItem = {
        id: Date.now().toString(),
        sourceText: textToTranslate,
        translatedText: resolved,
        sourceLang,
        targetLang,
        createdAt: Date.now(),
        hasAudio: Boolean(recordedAudioBlob),
      };

      saveNotes([newNote, ...notes.slice(0, 49)]);
    } catch (err: any) {
      console.error('Translation error:', err);
      setTranslationProgress({ status: 'error', error: 'Could not complete translation.' });
      showToast('Could not complete translation.', 'error');
    } finally {
      setTimeout(() => {
        setTranslationProgress((prev) => (prev.status === 'ready' || prev.status === 'translating' ? { status: 'idle' } : prev));
      }, 800);
    }
  };

  // Text-to-Speech
  const handleSpeakText = (text: string, lang: LanguageCode, isTarget = true) => {
    if (!text.trim()) return;

    if (isTarget) {
      if (isSpeakingTarget) {
        TextToSpeechManager.stop();
        setIsSpeakingTarget(false);
        return;
      }
      setIsSpeakingTarget(true);
      TextToSpeechManager.speak(text, lang, {
        rate: speechRate,
        onEnd: () => setIsSpeakingTarget(false),
        onError: () => setIsSpeakingTarget(false),
      });
    } else {
      if (isSpeakingSource) {
        TextToSpeechManager.stop();
        setIsSpeakingSource(false);
        return;
      }
      setIsSpeakingSource(true);
      TextToSpeechManager.speak(text, lang, {
        rate: speechRate,
        onEnd: () => setIsSpeakingSource(false),
        onError: () => setIsSpeakingSource(false),
      });
    }
  };

  // Toggle playback of recorded user microphone voice
  const handleTogglePlayRecordedAudio = () => {
    if (!recordedAudioUrl) return;
    const el = audioElementRef.current;
    if (!el) return;

    if (isPlayingRecordedAudio) {
      el.pause();
      setIsPlayingRecordedAudio(false);
    } else {
      el.play();
      setIsPlayingRecordedAudio(true);
    }
  };

  // Copy helpers
  const handleCopySource = async () => {
    if (!sourceText.trim()) return;
    await navigator.clipboard.writeText(sourceText);
    setCopiedSource(true);
    setTimeout(() => setCopiedSource(false), 2000);
  };

  const handleCopyTarget = async () => {
    if (!translatedText.trim()) return;
    await navigator.clipboard.writeText(translatedText);
    setCopiedTarget(true);
    setTimeout(() => setCopiedTarget(false), 2000);
  };

  // Load note from history back into editor
  const handleLoadNote = (note: NoteItem) => {
    setSourceLang(note.sourceLang);
    setTargetLang(note.targetLang);
    setSourceText(note.sourceText);
    setTranslatedText(note.translatedText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Note loaded into active editor!', 'success');
  };

  const handleDeleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
  };

  const handleClearAllNotes = () => {
    saveNotes([]);
    showToast('All notes cleared.', 'info');
  };

  const handleToggleFavorite = (id: string) => {
    saveNotes(
      notes.map((n) => (n.id === id ? { ...n, isFavorite: !n.isFavorite } : n))
    );
  };

  const currentSourceInfo = LANGUAGES[sourceLang];
  const currentTargetInfo = LANGUAGES[targetLang];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Hidden audio element for recorded microphone preview */}
      {recordedAudioUrl && (
        <audio
          ref={audioElementRef}
          src={recordedAudioUrl}
          onEnded={() => setIsPlayingRecordedAudio(false)}
          className="hidden"
        />
      )}

      {/* Offline Toast Banner */}
      {!isOnline && (
        <div className="bg-amber-500/90 text-slate-950 font-semibold text-xs py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode Active — Using cached translation dictionary and local speech synthesis.</span>
        </div>
      )}

      {/* Floating Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'error'
              ? 'bg-rose-950/95 border-rose-800 text-rose-200'
              : notification.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-800 text-emerald-200'
              : 'bg-slate-900/95 border-slate-700 text-cyan-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Radio className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
                <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
              </div>
              {isRecording && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950 animate-ping"></span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent">
                  VoiceLingo
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 tracking-wide uppercase">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Voice-to-Voice Translation & Smart Notebook • by {AUTHOR_NAME}
              </p>
            </div>
          </div>

          {/* Action Bar: PWA Install, WhatsApp, Feedback */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <PWAInstallButton />

            {/* Quick WhatsApp Share Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/40 transition active:scale-95"
              title="Share on WhatsApp (Voice, Text, or App)"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {/* Author & Feedback */}
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="About & Feedback (Waseem Asif)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Language Selection Header */}
        <LanguageSelector
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceChange={(lang) => setSourceLang(lang)}
          onTargetChange={(lang) => setTargetLang(lang)}
          onSwap={handleSwapLanguages}
          disabled={isRecording}
        />

        {/* Live Audio Visualizer / Frequency Bar */}
        <div className="relative">
          <AudioVisualizer
            analyser={analyser}
            isRecording={isRecording}
            isPlaying={isSpeakingSource || isSpeakingTarget || isPlayingRecordedAudio}
          />
          {isRecording && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-rose-950/80 border border-rose-800 px-3 py-1 rounded-full text-xs font-semibold text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span>Recording: {recordingSeconds}s</span>
            </div>
          )}
        </div>

        {/* Translation Studio Grid (Two Big Workspaces) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* LEFT: SOURCE TEXT WORKSPACE */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl shadow-cyan-950/20 space-y-3 focus-within:border-cyan-500/50 transition">
            {/* Header: Label, Language Tag, Clear */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">{currentSourceInfo.flag}</span>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {currentSourceInfo.name} ({currentSourceInfo.nativeName})
                </span>
                {isRecording && (
                  <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 animate-pulse">
                    Listening...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {sourceText && (
                  <button
                    onClick={() => {
                      setSourceText('');
                      setInterimText('');
                      setRecordedAudioBlob(null);
                      setRecordedAudioUrl(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
                    title="Clear text"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleCopySource}
                  disabled={!sourceText}
                  className="text-xs text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                  title="Copy text"
                >
                  {copiedSource ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleSpeakText(sourceText, sourceLang, false)}
                  disabled={!sourceText}
                  className="text-xs text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                  title="Listen to original speech"
                >
                  {isSpeakingSource ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Editable Textarea with live interim speech preview */}
            <div className="relative flex-1 min-h-[160px] sm:min-h-[200px]">
              <textarea
                value={
                  isRecording && interimText
                    ? sourceText
                      ? `${sourceText} ${interimText}`
                      : interimText
                    : sourceText
                }
                onChange={(e) => setSourceText(e.target.value)}
                dir={currentSourceInfo.isRtl ? 'rtl' : 'ltr'}
                placeholder={currentSourceInfo.placeholder}
                className={`w-full h-full bg-transparent resize-none text-white text-base sm:text-lg focus:outline-none placeholder-slate-600 leading-relaxed ${currentSourceInfo.fontClass}`}
              />
              {/* Active Listening indicator badge */}
              {isRecording && (
                <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-slate-950/95 border border-rose-500/50 px-3 py-1 rounded-full text-xs shadow-lg backdrop-blur-md animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-rose-300 font-medium">
                    {interimText ? interimText : 'سن رہا ہے... بولیں (Listening...)'}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Sample Prompts & Character counter */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 overflow-x-auto max-w-full pb-1">
                <span className="shrink-0 text-slate-400">Samples:</span>
                {SAMPLE_PROMPTS[sourceLang]?.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setSourceText(prompt)}
                    className="shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded-lg text-[11px] truncate max-w-[140px] border border-slate-700/60 transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500">{sourceText.length} chars</span>
            </div>

            {/* Voice Recording Controls */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-rose-950/50 transition transform active:scale-95 group"
                >
                  <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span>Start Recording (بولنا شروع کریں)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-rose-950/50 animate-pulse transition transform active:scale-95"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>Stop Recording (ریکارڈنگ روکیں)</span>
                </button>
              )}

              {/* Recorded Audio Clip preview player */}
              {recordedAudioUrl && (
                <button
                  onClick={handleTogglePlayRecordedAudio}
                  className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 text-xs font-semibold shadow-md transition"
                  title="Listen to recorded voice note"
                >
                  {isPlayingRecordedAudio ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>Voice Note</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: TARGET TRANSLATION WORKSPACE */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl shadow-emerald-950/20 space-y-3 focus-within:border-emerald-500/50 transition">
            {/* Header: Label, Language Tag, Speak Button */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">{currentTargetInfo.flag}</span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  {currentTargetInfo.name} ({currentTargetInfo.nativeName})
                </span>
                {translationProgress.status === 'translating' && (
                  <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 animate-pulse">
                    Translating...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {translatedText && (
                  <button
                    onClick={() => setTranslatedText('')}
                    className="text-xs text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
                    title="Clear translation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleCopyTarget}
                  disabled={!translatedText}
                  className="text-xs text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                  title="Copy translated text"
                >
                  {copiedTarget ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleSpeakText(translatedText, targetLang, true)}
                  disabled={!translatedText}
                  className={`text-xs p-1.5 rounded-lg transition disabled:opacity-30 ${
                    isSpeakingTarget
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                      : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                  }`}
                  title="Speak translation aloud"
                >
                  {isSpeakingTarget ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Editable Textarea for Translated Text */}
            <div className="relative flex-1 min-h-[160px] sm:min-h-[200px]">
              <textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                dir={currentTargetInfo.isRtl ? 'rtl' : 'ltr'}
                placeholder={currentTargetInfo.placeholder}
                className={`w-full h-full bg-transparent resize-none text-white text-base sm:text-lg focus:outline-none placeholder-slate-600 leading-relaxed ${currentTargetInfo.fontClass}`}
              />

              {/* Translation Progress Overlay */}
              {translationProgress.status === 'translating' && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 text-center space-y-2 animate-in fade-in duration-150">
                  <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-semibold text-emerald-300">
                    {translationProgress.statusText || 'Translating (ترجمہ کیا جا رہا ہے)...'}
                  </p>
                </div>
              )}
            </div>

            {/* Speech synthesis controls & char count */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Sliders className="w-3 h-3 text-emerald-400" />
                <span>Voice Speed:</span>
                {[0.8, 1.0, 1.2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setSpeechRate(rate)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                      speechRate === rate
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
              <span>{translatedText.length} chars</span>
            </div>

            {/* Action Bar: Translate Button & Speak Aloud Button */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleTranslate}
                disabled={!sourceText.trim() || translationProgress.status === 'translating'}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-cyan-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95 group"
              >
                <Sparkles className="w-4 h-4 text-slate-950 transition-transform group-hover:rotate-12" />
                <span>Translate (ترجمہ کریں)</span>
                <ArrowRight className="w-4 h-4 text-slate-950 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => handleSpeakText(translatedText, targetLang, true)}
                disabled={!translatedText.trim()}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-sm border border-slate-700 hover:border-emerald-500/40 disabled:opacity-40 transition active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                <span>Speak (آواز سنیں)</span>
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp Sharing Hub (Explicitly customized per user prompt) */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-800/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  WhatsApp Direct Sharing Center
                </h3>
                <p className="text-xs text-slate-400">
                  واٹس ایپ پر آواز، ٹیکسٹ، یا ویب سائٹ کا لنک الگ الگ بھیجیں
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
            >
              Open Full Share Modal
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1. Share Text */}
            <button
              onClick={() => {
                if (!sourceText.trim() && !translatedText.trim()) {
                  showToast('Please record or translate some text first to share.', 'info');
                  return;
                }
                shareTextOnWhatsApp(sourceText, translatedText, sourceLang, targetLang);
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-emerald-950/50 border border-slate-800 hover:border-emerald-600/50 transition group text-left"
            >
              <div>
                <p className="text-xs font-bold text-white group-hover:text-emerald-300">
                  1. Share Text
                </p>
                <p className="text-[11px] text-slate-400">واٹس ایپ پر ٹیکسٹ بھیجیں</p>
              </div>
              <Share2 className="w-4 h-4 text-emerald-400 transition-transform group-hover:scale-110" />
            </button>

            {/* 2. Share Voice */}
            <button
              onClick={() => {
                if (!recordedAudioBlob) {
                  showToast('Record your voice first using the microphone to share audio.', 'info');
                  return;
                }
                setIsShareModalOpen(true);
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-600/50 transition group text-left"
            >
              <div>
                <p className="text-xs font-bold text-white group-hover:text-cyan-300 flex items-center gap-1.5">
                  <span>2. Share Voice Clip</span>
                  {recordedAudioBlob && <span className="w-2 h-2 rounded-full bg-cyan-400"></span>}
                </p>
                <p className="text-[11px] text-slate-400">واٹس ایپ پر وائس نوٹ بھیجیں</p>
              </div>
              <Mic className="w-4 h-4 text-cyan-400 transition-transform group-hover:scale-110" />
            </button>

            {/* 3. Share Website */}
            <button
              onClick={shareWebsiteOnWhatsApp}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-600/50 transition group text-left"
            >
              <div>
                <p className="text-xs font-bold text-white group-hover:text-indigo-300">
                  3. Share App Link
                </p>
                <p className="text-[11px] text-slate-400">دوستوں کے ساتھ ایپ شیئر کریں</p>
              </div>
              <Download className="w-4 h-4 text-indigo-400 transition-transform group-hover:scale-110" />
            </button>
          </div>
        </div>

        {/* Translation Notebook History */}
        <NotesHistory
          notes={notes}
          onDeleteNote={handleDeleteNote}
          onClearAll={handleClearAllNotes}
          onToggleFavorite={handleToggleFavorite}
          onLoadNote={handleLoadNote}
        />
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-900 bg-slate-950/90 py-6 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">VoiceLingo</span>
            <span>•</span>
            <span>Offline-Ready Voice-to-Voice Translator</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Author: <strong className="text-white">{AUTHOR_NAME}</strong></span>
            <span>•</span>
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="hover:text-cyan-400 underline underline-offset-2 transition"
            >
              {AUTHOR_EMAIL}
            </button>
          </div>
        </div>
      </footer>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sourceText={sourceText}
        translatedText={translatedText}
        sourceLang={sourceLang}
        targetLang={targetLang}
        audioBlob={recordedAudioBlob}
        audioUrl={recordedAudioUrl}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  );
}
