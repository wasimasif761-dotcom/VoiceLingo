import React, { useState } from 'react';
import {
  History,
  Trash2,
  Copy,
  Check,
  Volume2,
  Share2,
  Star,
  Search,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { NoteItem, LanguageCode } from '../types';
import { LANGUAGES } from '../utils/languages';
import { shareTextOnWhatsApp } from '../utils/whatsapp';
import { TextToSpeechManager } from '../utils/speech';

interface NotesHistoryProps {
  notes: NoteItem[];
  onDeleteNote: (id: string) => void;
  onClearAll: () => void;
  onToggleFavorite: (id: string) => void;
  onLoadNote: (note: NoteItem) => void;
}

export const NotesHistory: React.FC<NotesHistoryProps> = ({
  notes,
  onDeleteNote,
  onClearAll,
  onToggleFavorite,
  onLoadNote,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavOnly, setFilterFavOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const filteredNotes = notes.filter((n) => {
    if (filterFavOnly && !n.isFavorite) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.sourceText.toLowerCase().includes(q) ||
      n.translatedText.toLowerCase().includes(q) ||
      LANGUAGES[n.sourceLang].name.toLowerCase().includes(q) ||
      LANGUAGES[n.targetLang].name.toLowerCase().includes(q)
    );
  });

  const handleCopy = async (note: NoteItem) => {
    try {
      const text = `${note.sourceText}\n\n[${LANGUAGES[note.targetLang].name}]: ${note.translatedText}`;
      await navigator.clipboard.writeText(text);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeak = (note: NoteItem) => {
    if (speakingId === note.id) {
      TextToSpeechManager.stop();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(note.id);
    TextToSpeechManager.speak(note.translatedText, note.targetLang, {
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  const handleShare = (note: NoteItem) => {
    shareTextOnWhatsApp(note.sourceText, note.translatedText, note.sourceLang, note.targetLang);
  };

  const handleExport = () => {
    if (notes.length === 0) return;
    const jsonStr = JSON.stringify(notes, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicelingo-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl shadow-cyan-950/20 space-y-4">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Translation Notebook & History</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {notes.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400">ترجمہ اور محفوظ شدہ نوٹس کی ہسٹری</p>
          </div>
        </div>

        {/* Clear & Export Buttons */}
        {notes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              title="Export Notes as JSON"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all translation history?')) {
                  onClearAll();
                }
              }}
              title="Clear All History"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      {notes.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search notes in Urdu, English, Arabic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <button
            onClick={() => setFilterFavOnly(!filterFavOnly)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              filterFavOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${filterFavOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Favorites</span>
          </button>
        </div>
      )}

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-600 mx-auto">
            <History className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-400">
            {notes.length === 0 ? 'No notes yet' : 'No matching notes found'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {notes.length === 0
              ? 'Your speech transcriptions and translated notes will be automatically saved here for quick access and WhatsApp sharing.'
              : 'Try searching with different keywords or clearing the search filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredNotes.map((note) => {
            const srcLangInfo = LANGUAGES[note.sourceLang];
            const tgtLangInfo = LANGUAGES[note.targetLang];

            return (
              <div
                key={note.id}
                className="group p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-950/90 transition-all shadow-sm space-y-3"
              >
                {/* Header row: languages badge, date, action buttons */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold">
                      <span>{srcLangInfo.flag}</span>
                      <span>{srcLangInfo.name}</span>
                      <span className="text-slate-500 font-normal">→</span>
                      <span>{tgtLangInfo.flag}</span>
                      <span>{tgtLangInfo.name}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">{formatTime(note.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-90 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onToggleFavorite(note.id)}
                      title={note.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                    >
                      <Star
                        className={`w-4 h-4 ${note.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => onLoadNote(note)}
                      title="Load into Editor"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSpeak(note)}
                      title="Speak Translation"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                    >
                      <Volume2 className={`w-4 h-4 ${speakingId === note.id ? 'text-emerald-400 animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleShare(note)}
                      title="Share to WhatsApp"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopy(note)}
                      title="Copy Note"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      {copiedId === note.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content: Source & Translation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {/* Source */}
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-500 font-medium mb-1 uppercase tracking-wider">
                      Original:
                    </p>
                    <p
                      dir={srcLangInfo.isRtl ? 'rtl' : 'ltr'}
                      className={`text-slate-200 ${srcLangInfo.fontClass} ${
                        srcLangInfo.isRtl ? 'text-right' : 'text-left'
                      }`}
                    >
                      {note.sourceText}
                    </p>
                  </div>

                  {/* Translated */}
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-emerald-400/90 font-medium mb-1 uppercase tracking-wider">
                      Translation:
                    </p>
                    <p
                      dir={tgtLangInfo.isRtl ? 'rtl' : 'ltr'}
                      className={`text-white font-medium ${tgtLangInfo.fontClass} ${
                        tgtLangInfo.isRtl ? 'text-right' : 'text-left'
                      }`}
                    >
                      {note.translatedText}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
