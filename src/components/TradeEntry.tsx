import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db, Trade } from '../Database';
import { X, ImagePlus, Trash2 } from 'lucide-react';
import { getStrategyCardClass, getStrategyTextClass } from '../utils/strategyColors';

// ─── Image compression helper ────────────────────────────────────────────────
const compressImage = (
  dataUrl: string,
  maxWidth = 1400,
  quality  = 0.75
): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width  = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });

// ─── Component ────────────────────────────────────────────────────────────────
export default function TradeEntry({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState<Partial<Trade>>({
    symbol:           '',
    direction:        'BUY',
    entryPrice:       0,
    stopLoss:         0,
    takeProfit:       0,
    lotSize:          0,
    strategy:         '',
    status:           'OPEN',
    bos:              'NONE',
    probability:      50,
    mistakes:         '',
    screenshot:       undefined,
    marketMovement:   0,
    capturedMovement: 0,
    rulesAdhered:     [],
    entryDate:        new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    exitDate:         '',
  });

  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragging,        setIsDragging]        = useState(false);
  const [newRule,           setNewRule]           = useState('');
  const imgInputRef = useRef<HTMLInputElement>(null);

  // ── Strategy & Rules Logic ──
  const userId = parseInt(localStorage.getItem('trading_user_id') || '1');
  const availableStrategies = useLiveQuery(() => db.strategies.where('userId').equals(userId).toArray(), [userId]);
  const currentStrategyRules = availableStrategies?.find(s => s.name === formData.strategy)?.rules || [];

  const handleRuleToggle = (rule: string) => {
    setFormData(prev => {
      const current = prev.rulesAdhered || [];
      const updated = current.includes(rule) ? current.filter(r => r !== rule) : [...current, rule];
      return { ...prev, rulesAdhered: updated };
    });
  };

  const handleAddRuleToStrategy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRule.trim() || !formData.strategy) return;
    
    const strategyName = formData.strategy.trim();
    const existingStrat = availableStrategies?.find(s => s.name === strategyName);
    const trimmedRule = newRule.trim();
    
    if (existingStrat) {
      if (!existingStrat.rules.includes(trimmedRule)) {
        await db.strategies.update(existingStrat.id!, {
          rules: [...existingStrat.rules, trimmedRule]
        });
      }
    } else {
      await db.strategies.add({
        userId,
        name: strategyName,
        rules: [trimmedRule]
      });
    }
    setNewRule('');
    handleRuleToggle(trimmedRule); // Automatically check the new rule
  };

  // ── Reset when modal closes ──
  const handleClose = () => {
    setFormData({
      symbol: '', direction: 'BUY', entryPrice: 0, stopLoss: 0,
      takeProfit: 0, lotSize: 0, strategy: '', status: 'OPEN',
      bos: 'NONE', probability: 50, mistakes: '', screenshot: undefined,
      marketMovement: 0, capturedMovement: 0, rulesAdhered: [],
      entryDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      exitDate: '',
    });
    setScreenshotPreview(null);
    setNewRule('');
    onClose();
  };
  // ── Screenshot handling ──
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setScreenshotPreview(compressed);
      setFormData(prev => ({ ...prev, screenshot: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = '';
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true);  };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const clearScreenshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScreenshotPreview(null);
    setFormData(prev => ({ ...prev, screenshot: undefined }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tradeData: any = {
      ...formData,
      userId,
      entryDate: formData.entryDate ? new Date(formData.entryDate).toISOString() : new Date().toISOString(),
    };
    if (formData.exitDate) {
      tradeData.exitDate = new Date(formData.exitDate).toISOString();
    } else {
      delete tradeData.exitDate;
    }
    await db.trades.add(tradeData as Trade);
    handleClose();
  };

  // ── Strategy suggestions ──
  const pastTrades = useLiveQuery(() => db.trades.where('userId').equals(userId).toArray());
  const historyStrategies = Array.from(new Set(pastTrades?.map((t: Trade) => t.strategy).filter(Boolean))) as string[];
  const defaultOptions    = ['SMC', 'ICT', 'BREAKOUT', 'SCALPING', 'OPEN', 'TREND FOLLOWING', 'REVERSAL'];
  const allOptions        = Array.from(new Set([...defaultOptions, ...historyStrategies, ...(availableStrategies?.map(s => s.name) || [])]));

  const captureRatio = formData.marketMovement && formData.marketMovement > 0 
    ? ((formData.capturedMovement || 0) / formData.marketMovement * 100).toFixed(1)
    : '0';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.9, rotateX: -10 }}
            className="glass-panel p-6 rounded-2xl w-full max-w-4xl z-10 border border-white/30 max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ perspective: '1000px' }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-orbitron font-bold text-white text-glow">NEW TRADE ENTRY</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-white" title="Close"><X /></button>
            </div>

            {/* Two-column layout: form + screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* ── Left: Trade Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4 font-inter">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="symbol" className="block text-xs text-gray-400 mb-1">SYMBOL</label>
                    <input id="symbol" required type="text" value={formData.symbol}
                      onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none"
                      placeholder="EURUSD" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">DIRECTION</label>
                    <div className="flex space-x-2">
                      <button type="button" onClick={() => setFormData({ ...formData, direction: 'BUY' })}
                        className={`flex-1 py-2 rounded font-bold border transition-all ${formData.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-black/50 text-gray-500 border-white/10'}`}>BUY</button>
                      <button type="button" onClick={() => setFormData({ ...formData, direction: 'SELL' })}
                        className={`flex-1 py-2 rounded font-bold border transition-all ${formData.direction === 'SELL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'bg-black/50 text-gray-500 border-white/10'}`}>SELL</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="entryDate" className="block text-xs text-gray-400 mb-1">ENTRY TIME</label>
                    <input id="entryDate" required type="datetime-local" value={formData.entryDate || ''}
                      onChange={e => setFormData({ ...formData, entryDate: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none text-sm" />
                  </div>
                  <div>
                    <label htmlFor="exitDate" className="block text-xs text-gray-400 mb-1">EXIT TIME (Optional)</label>
                    <input id="exitDate" type="datetime-local" value={formData.exitDate || ''}
                      onChange={e => setFormData({ ...formData, exitDate: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="entry" className="block text-xs text-gray-400 mb-1">ENTRY</label>
                    <input id="entry" required type="number" step="any" value={formData.entryPrice || ''}
                      onChange={e => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0.00" />
                  </div>
                  <div>
                    <label htmlFor="stopLoss" className="block text-xs text-gray-400 mb-1">STOP LOSS</label>
                    <input id="stopLoss" required type="number" step="any" value={formData.stopLoss || ''}
                      onChange={e => setFormData({ ...formData, stopLoss: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0.00" />
                  </div>
                  <div>
                    <label htmlFor="takeProfit" className="block text-xs text-gray-400 mb-1">TAKE PROFIT</label>
                    <input id="takeProfit" type="number" step="any" value={formData.takeProfit || ''}
                      onChange={e => setFormData({ ...formData, takeProfit: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="strategy" className="block text-xs text-gray-400 mb-1">STRATEGY</label>
                    <input id="strategy" list="strategy-options" type="text" value={formData.strategy}
                      onChange={e => setFormData({ ...formData, strategy: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none"
                      placeholder="e.g. SMC, ICT" />
                    <datalist id="strategy-options">
                      {allOptions.map(opt => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="lotSize" className="block text-xs text-gray-400 mb-1">LOT SIZE</label>
                    <input id="lotSize" type="number" step="any" value={formData.lotSize || ''}
                      onChange={e => setFormData({ ...formData, lotSize: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0.01" />
                  </div>
                </div>

                {/* Strategy Rules Checklist — always visible */}
                <div className={`bg-black/30 border rounded-lg p-3 transition-all ${getStrategyCardClass(formData.strategy || '')}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest ${getStrategyTextClass(formData.strategy || '')}`}>
                      📋 {formData.strategy ? `${formData.strategy} Rules Checklist` : 'Strategy Rules Checklist'}
                    </label>
                    {!formData.strategy && (
                      <span className="text-[9px] text-gray-600 italic">Enter a strategy name above first</span>
                    )}
                  </div>

                  {formData.strategy ? (
                    <>
                      <div className="space-y-1 mb-3">
                        {currentStrategyRules.map(rule => (
                          <label key={rule} className="flex items-center space-x-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={formData.rulesAdhered?.includes(rule)}
                              onChange={() => handleRuleToggle(rule)}
                              className="w-3 h-3 rounded border-white/20 bg-black/50 text-white focus:ring-white"
                            />
                            <span className={`text-xs transition-colors ${formData.rulesAdhered?.includes(rule) ? 'text-white font-bold' : 'text-gray-500 group-hover:text-gray-300'}`}>{rule}</span>
                          </label>
                        ))}
                        {currentStrategyRules.length === 0 && (
                          <p className="text-[10px] text-gray-500 italic">No rules yet — add your first rule below ↓</p>
                        )}
                      </div>
                      {/* Add Rule Input */}
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newRule}
                          onChange={e => setNewRule(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddRuleToStrategy(); }
                          }}
                          placeholder={`e.g. Wait for BOS confirmation...`}
                          className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddRuleToStrategy()}
                          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1 rounded text-[10px] font-bold transition-colors uppercase whitespace-nowrap"
                        >
                          + Add Rule
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-4 border border-dashed border-white/10 rounded">
                      <p className="text-[10px] text-gray-600 italic text-center">
                        Type your strategy name above to<br/>manage its specific rules here.
                      </p>
                    </div>
                  )}
                </div>



                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">STATUS</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setFormData({ ...formData, status: 'OPEN' })}
                        className={`py-1.5 rounded text-[10px] font-bold border transition-all ${formData.status === 'OPEN' ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'bg-black/50 text-gray-500 border-white/10'}`}>OPEN</button>
                      <button type="button" onClick={() => setFormData({ ...formData, status: 'WIN' })}
                        className={`py-1.5 rounded text-[10px] font-bold border transition-all ${formData.status === 'WIN' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-black/50 text-gray-500 border-white/10'}`}>WIN</button>
                      <button type="button" onClick={() => setFormData({ ...formData, status: 'LOSS' })}
                        className={`py-1.5 rounded text-[10px] font-bold border transition-all ${formData.status === 'LOSS' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'bg-black/50 text-gray-500 border-white/10'}`}>LOSS</button>
                      <button type="button" onClick={() => setFormData({ ...formData, status: 'BREAKEVEN' })}
                        className={`py-1.5 rounded text-[10px] font-bold border transition-all ${formData.status === 'BREAKEVEN' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-black/50 text-gray-500 border-white/10'}`}>BREAKEVEN</button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pnl" className="block text-xs text-gray-400 mb-1">P&L ($)</label>
                    <input id="pnl" type="number" step="any" value={formData.pnl || ''}
                      onChange={e => setFormData({ ...formData, pnl: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div>
                    <label htmlFor="marketMovement" className="block text-[10px] text-gray-400 mb-1">MARKET MOVED (PIPS)</label>
                    <input id="marketMovement" type="number" step="any" value={formData.marketMovement || ''}
                      onChange={e => setFormData({ ...formData, marketMovement: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0" />
                  </div>
                  <div>
                    <label htmlFor="capturedMovement" className="block text-[10px] text-gray-400 mb-1">I CAPTURED (PIPS)</label>
                    <input id="capturedMovement" type="number" step="any" value={formData.capturedMovement || ''}
                      onChange={e => setFormData({ ...formData, capturedMovement: parseFloat(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none" placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-gray-500 uppercase">Capture Efficiency</span>
                      <span className="text-white">{captureRatio}%</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded-full mt-1 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${captureRatio}%` }}
                        className={`h-full transition-all ${
                          parseFloat(captureRatio) >= 80 
                            ? 'bg-emerald-500' 
                            : parseFloat(captureRatio) >= 50 
                            ? 'bg-amber-500' 
                            : parseFloat(captureRatio) > 0 
                            ? 'bg-rose-500' 
                            : 'bg-white'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-xs text-gray-400 mb-1">NOTES</label>
                  <textarea id="notes" rows={2} value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none text-sm"
                    placeholder="Trade entry notes..." />
                </div>

                <div>
                  <label htmlFor="mistakes" className="block text-xs text-gray-400 mb-1">MISTAKES / EMOTIONS</label>
                  <input id="mistakes" list="mistake-options" type="text" value={formData.mistakes || ''}
                    onChange={e => setFormData({ ...formData, mistakes: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white focus:border-white outline-none text-sm"
                    placeholder="e.g. FOMO, Revenge Trading..." />
                  <datalist id="mistake-options">
                    <option value="FOMO" />
                    <option value="Revenge Trading" />
                    <option value="Moved Stop Loss" />
                    <option value="Overleveraged" />
                    <option value="Ignored Rules" />
                    <option value="Hesitated" />
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">BOS STRUCTURE</label>
                    <div className="flex space-x-1">
                      {(['BULLISH', 'BEARISH', 'NONE'] as const).map(b => {
                        let activeClasses = 'bg-white text-black border-white';
                        if (b === 'BULLISH') activeClasses = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
                        if (b === 'BEARISH') activeClasses = 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
                        return (
                          <button key={b} type="button" onClick={() => setFormData({ ...formData, bos: b })}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${formData.bos === b ? activeClasses : 'bg-black/50 border-white/10 text-gray-500'}`}>
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button type="submit"
                  className="w-full bg-white text-black font-orbitron font-bold py-3 rounded-lg hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] mt-4">
                  SAVE TRADE
                </button>
              </form>

              {/* ── Right: Screenshot Upload ── */}
              <div className="flex flex-col space-y-3">
                <div>
                  <h3 className="text-sm font-orbitron font-bold text-white flex items-center space-x-2 mb-1">
                    <ImagePlus size={16} />
                    <span>CHART SCREENSHOT</span>
                  </h3>
                  <p className="text-[10px] text-gray-500">Attach a chart image as a memory reference for this trade.</p>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => imgInputRef.current?.click()}
                  className={`relative rounded-xl overflow-hidden cursor-pointer border-2 border-dashed transition-all flex items-center justify-center min-h-[220px]
                    ${isDragging
                      ? 'border-white bg-white/10 scale-[1.01]'
                      : screenshotPreview
                        ? 'border-white/50 hover:border-white'
                        : 'border-white/10 hover:border-white bg-black/20'}`}
                >
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImgChange}
                    title="Upload chart screenshot"
                  />

                  {screenshotPreview ? (
                    <>
                      <img
                        src={screenshotPreview}
                        alt="Chart preview"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      {/* Overlay controls */}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Click to Replace</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearScreenshot}
                        title="Remove screenshot"
                        className="absolute top-2 right-2 bg-black/70 hover:bg-white hover:text-black text-white rounded-full p-1 transition-colors z-10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-center p-6">
                      <ImagePlus size={40} className="text-gray-500 mb-3" />
                      <span className="text-sm text-gray-400 font-bold">Drop chart image here</span>
                      <span className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">or click to browse</span>
                      <span className="text-[9px] text-gray-700 mt-3 uppercase">JPG · PNG · WEBP · GIF</span>
                    </div>
                  )}
                </div>

                {screenshotPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 text-[10px] text-white font-bold"
                  >
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Screenshot attached — will save with trade</span>
                  </motion.div>
                )}
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
