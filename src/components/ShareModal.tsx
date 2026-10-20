import React, { useState } from 'react';
import {
  X,
  Share2,
  FileText,
  Mic,
  Globe,
  Copy,
  Check,
  Download,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  formatWhatsAppMessage,
  shareTextOnWhatsApp,
  shareVoiceOnWhatsApp,
  shareWebsiteOnWhatsApp,
  AUTHOR_NAME,
} from '../utils/whatsapp';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

type ShareTab = 'text' | 'voice' | 'website';

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sourceText,
  translatedText,
  sourceLang,
  targetLang,
  audioBlob,
  audioUrl,
}) => {
  const [activeTab, setActiveTab] = useState<ShareTab>('text');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const formattedMsg = formatWhatsAppMessage(sourceText, translatedText, sourceLang, targetLang);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedMsg);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareText = () => {
    shareTextOnWhatsApp(sourceText, translatedText, sourceLang, targetLang);
  };

  const handleShareVoice = async () => {
    setShareStatus('Sharing voice clip...');
    const result = await shareVoiceOnWhatsApp(audioBlob);
    setShareStatus(result.message);
    setTimeout(() => setShareStatus(null), 4000);
  };

  const handleShareWebsite = () => {
    shareWebsiteOnWhatsApp();
  };

  const togglePlayAudio = () => {
    if (!audioUrl) return;
    const audioEl = document.getElementById('share-audio-preview') as HTMLAudioElement;
    if (!audioEl) return;

    if (isPlayingAudio) {
      audioEl.pause();
      setIsPlayingAudio(false);
    } else {
      audioEl.play();
      setIsPlayingAudio(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Share on WhatsApp</h2>
              <p className="text-xs text-slate-400">واٹس ایپ پر علیحدہ علیحدہ بھیجیں</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Distinct Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'text'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Text</span>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'voice'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>2. Voice Clip</span>
            {audioBlob && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>}
          </button>

          <button
            onClick={() => setActiveTab('website')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'website'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>3. PWA App</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* TAB 1: TEXT */}
          {activeTab === 'text' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    WhatsApp Message Preview
                  </span>
                  <button
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  {formattedMsg}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleShareText}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition active:scale-98"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Send Text on WhatsApp</span>
                </button>
                <button
                  onClick={handleCopyText}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition"
                >
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>Copy</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: VOICE */}
          {activeTab === 'voice' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {audioUrl ? (
                <>
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 text-center">
                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Recorded Audio Note Ready
                    </p>
                    <audio
                      id="share-audio-preview"
                      src={audioUrl}
                      onEnded={() => setIsPlayingAudio(false)}
                      className="hidden"
                    />

                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={togglePlayAudio}
                        className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30 transition active:scale-95"
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-6 h-6 fill-current" />
                        ) : (
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">Voice Note Clip</p>
                        <p className="text-xs text-slate-400">
                          {isPlayingAudio ? 'Playing preview...' : 'Ready to share on WhatsApp'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleShareVoice}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition active:scale-98"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share Audio to WhatsApp</span>
                    </button>
                    <a
                      href={audioUrl}
                      download="voicelingo-voice-clip.webm"
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
                    >
                      <Download className="w-4 h-4 text-cyan-400" />
                      <span>Download Voice File (.webm)</span>
                    </a>
                  </div>
                </>
              ) : (
                <div className="p-6 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                  <Mic className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-300">No voice recorded yet</p>
                  <p className="text-xs text-slate-500">
                    Press "Start Recording" in the main screen to speak and capture your voice note. Then you can share it directly!
                  </p>
                </div>
              )}

              {shareStatus && (
                <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs text-center">
                  {shareStatus}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PWA WEBSITE */}
          {activeTab === 'website' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold text-lg shadow-md">
                    VL
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">VoiceLingo PWA App Link</h4>
                    <p className="text-xs text-slate-400">Created by {AUTHOR_NAME}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  🎙️ Share the VoiceLingo Progressive Web App link with family, friends, or colleagues on WhatsApp so they can translate speech in real time!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleShareWebsite}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition active:scale-98"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Send App Link on WhatsApp</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>Copy Link</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            VoiceLingo • Author: <span className="text-slate-400">{AUTHOR_NAME}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
