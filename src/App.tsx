/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioResult, setAudioResult] = useState<string>('');
  const [imageResult, setImageResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [soundPrompt, setSoundPrompt] = useState<string>('');
  const [generatedSound, setGeneratedSound] = useState<{result: string, audioUrl: string} | null>(null);

  const handleAudioUpload = async () => {
    if (!audioFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', audioFile);
    const res = await fetch('/api/analyze-audio', { method: 'POST', body: formData });
    const data = await res.json();
    setAudioResult(data.result);
    setLoading(false);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', imageFile);
    const res = await fetch('/api/analyze-image', { method: 'POST', body: formData });
    const data = await res.json();
    setImageResult(data.result);
    setLoading(false);
  };

  const handleGenerateSound = async () => {
    if (!soundPrompt) return;
    setLoading(true);
    const res = await fetch('/api/generate-sound', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ prompt: soundPrompt }) 
    });
    const data = await res.json();
    setGeneratedSound(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0F1117] text-slate-300 p-8 font-sans">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Sonic Blueprint Engine</h1>
        <div className="text-xs font-bold uppercase tracking-widest">
            <span className="text-slate-400">by </span>
            <span className="harpstar-brand">
              <a href="https://harpstarunlimited.com" target="_blank" rel="noopener" className="hover:underline">Harp★Star</a>
            </span>
        </div>
      </header>
      
      <div className="space-y-6">
        <section className="bg-[#1A1D26] p-6 rounded-xl border border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Suno Prompt Generator</h2>
          <div className="flex gap-4 items-center">
            <input type="file" accept="audio/*,video/mp4" className="text-xs file:bg-slate-800 file:text-slate-300 file:border-0 file:rounded file:px-3 file:py-1 text-slate-500" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            <button className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-4 py-2 rounded transition-colors font-bold uppercase" onClick={handleAudioUpload} disabled={loading}>{loading ? 'Analyzing...' : 'Analyze'}</button>
          </div>
          <pre className="mt-4 p-4 bg-[#0F1117] border border-slate-800 rounded font-mono text-xs text-slate-400 overflow-x-auto">{audioResult}</pre>
        </section>

        <section className="bg-[#1A1D26] p-6 rounded-xl border border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Phoenix Oracle Foley Engine</h2>
          <div className="flex gap-4 items-center">
              <input type="file" accept="image/*,audio/mpeg" className="text-xs file:bg-slate-800 file:text-slate-300 file:border-0 file:rounded file:px-3 file:py-1 text-slate-500" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <button className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white px-4 py-2 rounded transition-colors font-bold uppercase" onClick={handleImageUpload} disabled={loading}>{loading ? 'Analyzing...' : 'Analyze'}</button>
          </div>
          {imageResult && <pre className="mt-4 p-4 bg-[#0F1117] border border-slate-800 rounded font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(imageResult, null, 2)}</pre>}
        </section>

        <section className="bg-[#1A1D26] p-6 rounded-xl border border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Real-Time Sound Generator</h2>
          <div className="flex gap-4 items-center">
            <input type="text" className="bg-[#0F1117] border border-slate-700 text-white text-xs p-2 rounded flex-1" placeholder="Describe the sound..." onChange={(e) => setSoundPrompt(e.target.value)} />
            <button className="bg-orange-600 hover:bg-orange-500 text-xs text-white px-4 py-2 rounded transition-colors font-bold uppercase" onClick={handleGenerateSound} disabled={loading}>{loading ? 'Generating...' : 'Generate'}</button>
          </div>
          {generatedSound && (
            <div className="mt-4 p-4 bg-[#0F1117] border border-slate-800 rounded">
                <p className="text-xs text-slate-300 mb-2">{generatedSound.result}</p>
                <audio controls src={generatedSound.audioUrl} className="w-full h-8" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
