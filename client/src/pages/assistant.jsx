import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL, authHeaders, getUser, isLoggedIn, clearAuth, ensureGuestAuth } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';

const SUGGESTIONS = [
  'Mera dashboard kaise kaam karta hai?',
  'Pothole photo kaisi lagegi, kya look karu?',
  'Aaj Delhi ka mausam kaisa hai?',
  'Sabse tez gadi kaun si hai?',
];

export default function Assistant() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const user = getUser();

  useEffect(() => {
    if (!isLoggedIn()) {
      ensureGuestAuth().then(() => {
        setMessages([
          {
            role: 'assistant',
            content:
              'Namaste! 🎉 Main aapka CivicEye Assistant hoon. Main image samajh sakta hoon, aapke complaints ke bare mein bata sakta hoon, aur general sawalon ka live web search kar sakta hoon. Aap kaise madad karun?',
          },
        ]);
      });
    } else {
      setMessages([
        {
          role: 'assistant',
          content:
            'Namaste! 🎉 Main aapka CivicEye Assistant hoon. Main image samajh sakta hoon, aapke complaints ke bare mein bata sakta hoon, aur general sawalon ka live web search kar sakta hoon. Aap kaise madad karun?',
        },
      ]);
    }
    const hasRec = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setRecognitionSupported(hasRec);
  }, [router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setListening(false);
  }, []);

  const sendMessage = async (textOverride, fileImage = image) => {
    const text = (textOverride ?? input).trim();
    if ((!text && !fileImage) || loading) return;

    setLoading(true);
    setError(null);
    setInput('');

    const userMsg = {
      role: 'user',
      content: text || 'Is image ko analyze kar ke batao',
      image: fileImage || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const payload = {
        message: text || 'Is image ko analyze kar ke batao',
        history,
        ...(fileImage ? { imageBase64: fileImage.base64, mimeType: fileImage.mimeType } : {}),
      };
      const res = await axios.post(`${API_URL}/api/assistant/chat`, payload, {
        headers: authHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = res.data;
      setMessages((prev) => [...prev, { role: 'assistant', ...data }]);
      if (speak && data.message && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(data.message.replace(/[*#_`]/g, ''));
        utter.rate = 1;
        utter.pitch = 1;
        window.speechSynthesis.speak(utter);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        clearAuth();
        window.localStorage.removeItem('civiceye_guest_tried');
        const token = await ensureGuestAuth();
        if (token) {
          setError('Session expire ho gaya tha — naya guest bana liya. Dobara try karein.');
          return;
        }
        router.replace('/login?next=/assistant');
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Kuch gadbad hui: ${err.response?.data?.error || err.message}`,
        },
      ]);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMic = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (listening) {
      stopListening();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'hi-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      setInput(spoken);
      if (spoken.trim()) {
        sendMessage(spoken, image);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {}
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1];
      setImage({ base64, mimeType: file.type || 'image/jpeg', preview: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const sendSuggestion = (s) => sendMessage(s, null);

  return (
    <>
      <Head>
        <title>CivicEye 2.0 — AI Assistant</title>
      </Head>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative min-h-screen pb-28">
        <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto] items-center px-6 py-4">
            <Link href="/" className="grid grid-flow-col auto-cols-max items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
                CE
              </div>
              <div>
                <span className="block text-sm font-bold text-white">
                  CivicEye <span className="text-cyan-400">2.0</span>
                </span>
                <span className="block text-[10px] uppercase tracking-widest text-slate-500">AI Assistant</span>
              </div>
            </Link>
            <div className="grid grid-flow-col auto-cols-max items-center gap-2">
              <ThemeToggle />
              <span className="hidden rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 sm:block">
                {user?.name || 'Citizen'}
              </span>
              <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white">
                Dashboard
              </Link>
              <button
                onClick={() => {
                  clearAuth();
                  router.replace('/login');
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/40 hover:text-red-300"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-3xl px-4 pt-8">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-white">
              CivicEye <span className="gradient-text">AI Assistant</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Image samjho • Complaints batao • Live web search karo 🧠
            </p>
          </div>

          {/* Chat area */}
          <div
            ref={scrollRef}
            className="glass-card h-[55vh] space-y-4 overflow-y-auto p-5"
          >
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {loading && (
              <div className="grid grid-flow-col auto-cols-max items-center gap-2 text-xs text-slate-400 animate-fade-in">
                <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-cyan-500 border-t-transparent" />
                <span>Assistant soch raha hai...</span>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendSuggestion(s)}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-2.5 text-left text-xs font-medium text-slate-400 transition-all hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 animate-slide-up rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/60 bg-slate-950/90 p-4 backdrop-blur-xl">
            <div className="mx-auto grid max-w-3xl gap-2">
              {image && (
                <div className="grid grid-flow-col auto-cols-max items-center gap-2 justify-self-start rounded-xl border border-cyan-500/30 bg-slate-800/60 p-2">
                  <img src={image.preview} alt="Attached" className="h-10 w-10 rounded-lg object-cover" />
                  <span className="text-xs font-medium text-cyan-300">Photo attached</span>
                  <button
                    onClick={() => setImage(null)}
                    className="grid h-6 w-6 place-items-center rounded-full text-xs text-slate-400 hover:bg-slate-700"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
                <button
                  onClick={() => document.getElementById('chat-image-input')?.click()}
                  className="grid h-12 w-12 place-items-center rounded-xl border border-slate-700/60 bg-slate-800/50 text-lg transition-colors hover:border-cyan-500/50 hover:bg-slate-800"
                  title="Attach photo"
                >
                  📷
                </button>
                <input
                  id="chat-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Message likho ya mic dabao..."
                  className="input-field py-3.5"
                />
                <button
                  onClick={handleMic}
                  disabled={!recognitionSupported}
                  className={`grid h-12 w-12 place-items-center rounded-xl border text-lg transition-colors ${
                    listening
                      ? 'border-red-500/60 bg-red-500/20 animate-pulse-slow'
                      : 'border-slate-700/60 bg-slate-800/50 hover:border-cyan-500/50'
                  } disabled:opacity-40`}
                  title={listening ? 'Stop listening' : 'Speak'}
                >
                  {listening ? '⏹️' : '🎤'}
                </button>
                <button
                  onClick={() => setSpeak((s) => !s)}
                  className={`grid h-12 w-12 place-items-center rounded-xl border text-lg transition-colors ${
                    speak
                      ? 'border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20'
                      : 'border-slate-700/60 bg-slate-800/50 opacity-50 hover:opacity-100'
                  }`}
                  title={speak ? 'Voice reply on' : 'Voice reply off'}
                >
                  {speak ? '🔊' : '🔇'}
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || (!input.trim() && !image)}
                  className="btn-primary grid h-12 grid-flow-col auto-cols-max items-center gap-2 px-5 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </button>
              </div>
              {!recognitionSupported && (
                <p className="text-center text-[10px] text-slate-600">
                  🎤 Voice input ab is browser me support nahi hai — Chrome try karo. Voice reply chrome/firefox me chalta hai.
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[80%]">
          {msg.image && (
            <img src={msg.image.preview} alt="Sent" className="mb-2 h-32 w-44 rounded-xl object-cover" />
          )}
          <div className="rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-cyan-500/20">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-slide-up">
      <div className="max-w-[85%]">
        <div className="mb-1 grid grid-flow-col auto-cols-max items-center gap-1.5 px-1">
          <span className="badge bg-cyan-500/15 text-cyan-400">🤖 Assistant</span>
          {msg.type === 'web' && <span className="badge bg-purple-500/15 text-purple-300">🌐 Web Search</span>}
          {msg.type === 'image' && <span className="badge bg-emerald-500/15 text-emerald-300">🖼️ Image</span>}
          {msg.type === 'civic' && <span className="badge bg-blue-500/15 text-blue-300">🏛️ App</span>}
        </div>
        <div className="rounded-2xl rounded-bl-sm border border-slate-700/50 bg-slate-800/60 px-4 py-2.5 text-sm leading-relaxed text-slate-200">
          <span className="whitespace-pre-wrap">{msg.content}</span>
        </div>
        {msg.results && msg.results.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {msg.results.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-flow-col auto-cols-max items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs font-medium text-cyan-300 transition-all hover:border-cyan-500/50 hover:bg-slate-800/60"
              >
                <span>🔗</span>
                <span className="max-w-[300px] truncate">{r.title || r.url}</span>
                <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                  Open
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}