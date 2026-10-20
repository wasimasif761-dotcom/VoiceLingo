import React, { useState } from 'react';
import { X, Mail, MessageCircle, Heart, User, Copy, Check } from 'lucide-react';
import { AUTHOR_NAME, AUTHOR_EMAIL, openEmailFeedback, openWhatsAppFeedback } from '../utils/whatsapp';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!isOpen) return null;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(AUTHOR_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">About & Feedback</h3>
              <p className="text-xs text-slate-400">مصنف اور رائے</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-cyan-400 font-semibold tracking-wider uppercase">Author / Developer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                VoiceLingo PWA
              </span>
            </div>
            <div>
              <h4 className="text-lg font-extrabold text-white">{AUTHOR_NAME}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Senior Frontend & Web Audio Translation Engineering
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 truncate">{AUTHOR_EMAIL}</span>
              <button
                onClick={handleCopyEmail}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Thank you for using VoiceLingo! Your feedback, feature suggestions, and language improvement ideas are very welcome.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={openEmailFeedback}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 transition"
            >
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Email Feedback</span>
            </button>

            <button
              onClick={openWhatsAppFeedback}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950/40 transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Feedback</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <span>Made with</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          <span>for effortless multilingual communication</span>
        </div>
      </div>
    </div>
  );
};
