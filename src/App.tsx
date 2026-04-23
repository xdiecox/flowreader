/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Save, Trash2, Volume2, Settings2, History, ChevronRight, Headset, SkipBack, SkipForward, Eye, Edit3, Copy, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SavedAudio, VoiceOption } from './types';

export default function App() {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [activeTab, setActiveTab] = useState<'reader' | 'library'>('reader');
  const [viewMode, setViewMode] = useState<'edit' | 'read'>('edit');
  
  // Reading state
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);

  const synth = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      synth.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        
        const formatName = (name: string) => {
          return name
            .replace(/ - (?:Spanish|English|Spanish \(Mexico\)|English \(United States\)).*/i, '')
            .split(' (')[0] // Safely catch remaining parenthesis info
            .trim();
        };

        const formatted = availableVoices.map(v => ({
          name: formatName(v.name),
          originalName: v.name,
          lang: v.lang,
          voice: v
        }));

        // Custom sorting
        const priority = [
          'Microsoft Sabina - Spanish (Mexico)',
          'Microsoft Raul - Spanish (Mexico)',
          'Microsoft Zira - English (United States)',
          'Microsoft Mark - English (United States)',
          'Microsoft David - English (United States)'
        ];

        const sorted = [...formatted].sort((a, b) => {
          const indexA = priority.indexOf(a.originalName);
          const indexB = priority.indexOf(b.originalName);
          
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          
          return a.name.localeCompare(b.name);
        });

        setVoices(sorted);
        
        // Default to Microsoft Sabina
        const sabina = sorted.find(v => v.originalName === 'Microsoft Sabina - Spanish (Mexico)');
        const defaultVoice = sabina || sorted.find(v => v.lang.startsWith('es')) || sorted[0];
        
        if (defaultVoice && !selectedVoice) {
          setSelectedVoice(defaultVoice.name);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Load from local storage
    const stored = localStorage.getItem('vozreader_library');
    if (stored) {
      try {
        setSavedAudios(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading library', e);
      }
    }
  }, []);

  const handlePlay = (paragraphIdx?: number, customSettings?: { voice?: string, rate?: number }) => {
    if (!synth.current) return;

    const idx = typeof paragraphIdx === 'number' ? paragraphIdx : currentParagraphIndex;
    const textToRead = paragraphs[idx];

    if (!textToRead) {
      setIsPlaying(false);
      return;
    }

    if (isPaused && typeof paragraphIdx !== 'number') {
      synth.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    synth.current.cancel();

    const utterance = new SpeechSynthesisUtterance(textToRead);
    const voice = voices.find(v => v.name === (customSettings?.voice || selectedVoice))?.voice;
    
    if (voice) utterance.voice = voice;
    utterance.rate = customSettings?.rate || rate;
    utterance.pitch = pitch;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentCharIndex(event.charIndex);
      }
    };

    utterance.onend = () => {
      // Auto-advance to next paragraph
      if (idx < paragraphs.length - 1) {
        setCurrentParagraphIndex(idx + 1);
        handlePlay(idx + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentCharIndex(0);
        setCurrentParagraphIndex(0);
      }
    };

    utterance.onpause = () => {
      setIsPaused(true);
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    synth.current.speak(utterance);
    setIsPlaying(true);
    setCurrentParagraphIndex(idx);
    if (viewMode === 'edit' && paragraphs.length > 0) {
      setViewMode('read');
    }
  };

  const handleNextParagraph = () => {
    if (currentParagraphIndex < paragraphs.length - 1) {
      handlePlay(currentParagraphIndex + 1);
    }
  };

  const handlePrevParagraph = () => {
    if (currentParagraphIndex > 0) {
      handlePlay(currentParagraphIndex - 1);
    } else {
      handlePlay(0);
    }
  };

  const handlePause = () => {
    if (synth.current && isPlaying) {
      synth.current.pause();
    }
  };

  const handleStop = () => {
    if (synth.current) {
      synth.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const handleSave = () => {
    if (!text.trim()) return;
    
    const newAudio: SavedAudio = {
      id: crypto.randomUUID(),
      title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
      text,
      voiceName: selectedVoice,
      rate,
      pitch,
      date: Date.now()
    };

    const updated = [newAudio, ...savedAudios];
    setSavedAudios(updated);
    localStorage.setItem('vozreader_library', JSON.stringify(updated));
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const handleDelete = (id: string) => {
    const updated = savedAudios.filter(a => a.id !== id);
    setSavedAudios(updated);
    localStorage.setItem('vozreader_library', JSON.stringify(updated));
  };

  const handleClear = () => {
    setText('');
    setCurrentParagraphIndex(0);
    setCurrentCharIndex(0);
    setShowClearConfirm(false);
  };

  const handleCopy = async () => {
    if (!text.trim()) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      // Robust Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopyStatus(true);
          setTimeout(() => setCopyStatus(false), 2000);
        }
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="min-h-screen bg-calm-bg text-calm-ink font-sans selection:bg-calm-ink selection:text-calm-bg">
      {/* Navigation */}
      <nav className="border-b border-calm-ink/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-calm-bg/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-calm-ink rounded-full flex items-center justify-center text-calm-bg shadow-sm">
            <Headset size={18} />
          </div>
          <h1 className="font-bold tracking-tighter text-xl uppercase text-calm-ink/90">Flow Reader AI</h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('reader')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
              activeTab === 'reader' ? 'bg-calm-ink text-calm-bg shadow-md' : 'hover:bg-slate-200/50'
            }`}
            id="nav-reader"
          >
            <Volume2 size={18} />
            <span className="text-sm font-medium uppercase tracking-wider">Lector</span>
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
              activeTab === 'library' ? 'bg-calm-ink text-calm-bg shadow-md' : 'hover:bg-slate-200/50'
            }`}
            id="nav-library"
          >
            <History size={18} />
            <span className="text-sm font-medium uppercase tracking-wider">Biblioteca</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {activeTab === 'reader' ? (
            <motion.div 
              key="reader"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              id="reader-view"
            >
              {/* Text Area */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => setViewMode('read')}
                      className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 transition-all ${
                        viewMode === 'read' ? 'bg-calm-ink text-calm-bg shadow-sm' : 'bg-slate-200/50 border border-slate-300/30'
                      }`}
                    >
                      <Eye size={12} /> Lectura
                    </button>
                    <button 
                      onClick={() => setViewMode('edit')}
                      className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider flex items-center justify-center transition-all ${
                        viewMode === 'edit' ? 'bg-calm-ink text-calm-bg shadow-sm' : 'bg-slate-200/50 border border-slate-300/30'
                      }`}
                      title="Editar"
                    >
                      <Edit3 size={12} />
                    </button>
                    
                    <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                    
                    <button 
                      onClick={handleCopy}
                      className={`p-1.5 rounded-lg transition-all border border-transparent shadow-sm ${
                        copyStatus ? 'bg-green-100 text-green-600 border-green-200' : 'text-calm-ink/60 hover:bg-slate-200/50 hover:text-calm-ink hover:border-slate-300/30'
                      }`}
                      title="Copiar todo"
                    >
                      <Copy size={14} />
                    </button>
                    
                    <button 
                      onClick={handleClear}
                      className="p-1.5 rounded-lg text-calm-ink/60 hover:bg-red-50 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                      title="Borrar todo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <span className="font-mono text-[10px] opacity-50">{text.length} caracteres | {paragraphs.length} párrafos</span>
                </div>

                <div className="relative min-h-[400px]">
                  <AnimatePresence mode="wait">
                    {viewMode === 'edit' ? (
                      <motion.textarea
                        key="edit-area"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Pega tu texto aquí para comenzar la lectura..."
                        className="w-full h-[400px] bg-white/70 border border-slate-200 p-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-calm-ink/20 transition-all resize-none shadow-sm"
                        id="text-input"
                      />
                    ) : (
                      <motion.div
                        key="read-area"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-[400px] bg-white/70 border border-slate-200 p-8 rounded-2xl overflow-y-auto shadow-sm leading-relaxed text-lg"
                        id="reader-display"
                      >
                        {paragraphs.length === 0 ? (
                          <div className="text-center opacity-30 italic mt-12">No hay texto para leer.</div>
                        ) : (
                          paragraphs.map((p, pIdx) => (
                            <div 
                              key={pIdx} 
                              className={`mb-6 transition-all duration-500 ${
                                pIdx === currentParagraphIndex ? 'opacity-100 scale-[1.01]' : 'opacity-70'
                              }`}
                            >
                              {pIdx === currentParagraphIndex ? (
                                p.split(/(\s+)/).reduce((acc, word, wIdx, array) => {
                                  const textBefore = array.slice(0, wIdx).join('');
                                  const isCurrent = textBefore.length <= currentCharIndex && (textBefore.length + word.length) > currentCharIndex && word.trim().length > 0;
                                  
                                  acc.push(
                                    <span 
                                      key={wIdx} 
                                      className={`${isCurrent ? 'bg-calm-highlight px-1 rounded transition-all duration-300' : ''}`}
                                    >
                                      {word}
                                    </span>
                                  );
                                  return acc;
                                }, [] as React.ReactNode[])
                              ) : (
                                <span>{p}</span>
                              )}
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={handlePrevParagraph}
                    className="aspect-square bg-white/60 border border-slate-200 text-calm-ink rounded-xl flex items-center justify-center hover:bg-white transition-all shadow-sm"
                    title="Párrafo anterior"
                  >
                    <SkipBack fill="currentColor" size={20} />
                  </button>
                  
                  <button
                    onClick={() => isPlaying ? handlePause() : handlePlay()}
                    className="flex-1 bg-calm-ink text-calm-bg py-4 rounded-xl flex items-center justify-center gap-3 hover:shadow-lg active:scale-95 transition-all group"
                    id="play-button"
                  >
                    {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
                    <span className="font-bold uppercase tracking-widest">
                      {isPlaying ? 'Pausar' : isPaused ? 'Reanudar' : 'Reproducir'}
                    </span>
                  </button>

                  <button
                    onClick={handleNextParagraph}
                    className="aspect-square bg-white/60 border border-slate-200 text-calm-ink rounded-xl flex items-center justify-center hover:bg-white transition-all shadow-sm"
                    title="Siguiente párrafo"
                  >
                    <SkipForward fill="currentColor" size={20} />
                  </button>

                  <button
                    onClick={handleStop}
                    className="aspect-square bg-white/60 border border-slate-200 text-calm-ink rounded-xl flex items-center justify-center hover:bg-white transition-all shadow-sm"
                    id="stop-button"
                    title="Detener"
                  >
                    <Square fill="currentColor" size={20} />
                  </button>
                  <button
                    onClick={handleSave}
                    className={`aspect-square border rounded-xl flex items-center justify-center transition-all shadow-sm ${
                      saveStatus ? 'bg-green-100 border-green-200 text-green-600 animate-pulse' : 'bg-white/60 border-slate-200 text-calm-ink hover:bg-white'
                    }`}
                    id="save-button"
                    title="Guardar"
                  >
                    <Save size={20} />
                  </button>
                </div>
              </div>

              {/* Controls Column */}
              <div className="flex flex-col gap-8">
                <section className="bg-white/40 p-6 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings2 size={16} className="text-calm-accent" />
                    <h2 className="font-mono text-xs uppercase tracking-widest font-bold">Ajustes</h2>
                  </div>
                  
                  <div className="space-y-8">
                    {/* Voice Selection */}
                    <div>
                      <label className="font-mono text-[10px] uppercase opacity-50 block mb-3 font-bold">Voz sintetizada</label>
                      <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full bg-white/80 border border-slate-200 px-4 py-3 rounded-lg focus:outline-none text-sm appearance-none cursor-pointer shadow-sm hover:border-calm-accent transition-colors"
                        id="voice-select"
                      >
                        {voices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Rate Control */}
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="font-mono text-[10px] uppercase opacity-50 font-bold">Velocidad de lectura</label>
                        <span className="font-mono text-[10px] font-bold bg-calm-ink text-calm-bg px-2 py-0.5 rounded">{rate}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2" 
                        step="0.1" 
                        value={rate}
                        onChange={(e) => setRate(parseFloat(e.target.value))}
                        className="w-full accent-calm-ink cursor-pointer"
                        id="rate-slider"
                      />
                    </div>

                    {/* Pitch Control */}
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="font-mono text-[10px] uppercase opacity-50 font-bold">Tono vocal</label>
                        <span className="font-mono text-[10px] font-bold bg-calm-ink text-calm-bg px-2 py-0.5 rounded">{pitch}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2" 
                        step="0.1" 
                        value={pitch}
                        onChange={(e) => setPitch(parseFloat(e.target.value))}
                        className="w-full accent-calm-ink cursor-pointer"
                        id="pitch-slider"
                      />
                    </div>
                  </div>
                </section>

                {/* Info Card */}
                <div className="bg-calm-ink/5 border border-calm-ink/10 p-6 rounded-2xl">
                  <p className="text-xs leading-relaxed opacity-70 italic">
                    Note: Adjust reading speed in real-time. Premium voices are system-dependent.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
              id="library-view"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                  <History size={16} />
                  Tus audios guardados
                </h2>
                <span className="font-mono text-[10px] opacity-50">{savedAudios.length} guardados</span>
              </div>

              {savedAudios.length === 0 ? (
                <div className="bg-white/40 border border-slate-200 border-dashed p-12 rounded-2xl text-center backdrop-blur-sm">
                  <p className="text-sm opacity-50 italic">Tu biblioteca está vacía. Guarda tus textos para escucharlos luego.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedAudios.map((audio) => (
                    <motion.div 
                      key={audio.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white/80 border border-slate-200 p-6 rounded-2xl flex flex-col gap-4 group hover:shadow-xl hover:border-calm-accent/30 transition-all backdrop-blur-sm"
                      id={`audio-card-${audio.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-sm truncate pr-2 text-calm-ink">{audio.title}</h3>
                          <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{new Date(audio.date).toLocaleDateString()}</p>
                        </div>
                        <button 
                          onClick={() => handleDelete(audio.id)}
                          className="text-calm-ink/30 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] bg-calm-ink/5 px-2 py-0.5 rounded uppercase font-bold text-calm-accent">Voz: {audio.voiceName.split(' ')[0]}</span>
                        <span className="font-mono text-[9px] bg-calm-ink/5 px-2 py-0.5 rounded uppercase font-bold text-calm-accent">{audio.rate}x</span>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => {
                            setActiveTab('reader');
                            setText(audio.text);
                            setSelectedVoice(audio.voiceName);
                            setRate(audio.rate);
                            handlePlay(undefined, { voice: audio.voiceName, rate: audio.rate });
                          }}
                          className="flex-1 bg-calm-ink text-calm-bg py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                          <Play size={14} fill="currentColor" />
                          Escuchar
                        </button>
                        <button 
                          onClick={() => {
                            setActiveTab('reader');
                            setText(audio.text);
                            setSelectedVoice(audio.voiceName);
                            setRate(audio.rate);
                          }}
                          className="px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-center transition-all hover:bg-calm-ink hover:text-calm-bg shadow-sm"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
