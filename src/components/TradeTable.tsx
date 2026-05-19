import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db, Trade } from '../Database';
import { Trash2, Download, Upload, FileSpreadsheet, Camera, X, ZoomIn } from 'lucide-react';
import { exportTradesToExcel, importTradesFromExcel } from '../utils/excel';
import { getStrategyClass } from '../utils/strategyColors';

// ─── Image compression (shared helper) ────────────────────────────────────────
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

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          exit={{    scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative max-w-[90vw] max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          <img
            src={src}
            alt="Trade chart screenshot"
            className="max-w-[90vw] max-h-[85vh] rounded-xl border border-white/30 shadow-[0_0_60px_rgba(255,255,255,0.15)] object-contain"
          />
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 bg-black border border-white/20 hover:bg-neonRed text-white rounded-full p-1.5 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 uppercase tracking-widest">
            Press Esc or click outside to close
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Editable Cell ────────────────────────────────────────────────────────────
const EditableCell = ({
  value,
  onSave,
  isEditing,
  onStartEdit,
  type      = 'text',
  className = '',
  formatter = (v: any) => v,
  listId    = '',
}: {
  value:       any;
  onSave:      (val: string) => void;
  isEditing:   boolean;
  onStartEdit: () => void;
  type?:       string;
  className?:  string;
  formatter?:  (v: any) => string;
  listId?:     string;
}) => {
  const [val, setVal] = React.useState(value);
  React.useEffect(() => { setVal(value); }, [value]);

  if (isEditing) {
    return (
      <td className="px-4 py-2">
        <input
          autoFocus
          type={type}
          list={listId || undefined}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => onSave(val)}
          onKeyDown={e => {
            if (e.key === 'Enter')  onSave(val);
            if (e.key === 'Escape') { setVal(value); onSave(value); }
          }}
          className="w-full bg-black/80 border border-white rounded px-2 py-1 text-white outline-none"
          aria-label={`Edit ${type}`}
          placeholder={`Enter ${type}...`}
        />
        {listId && (
          <datalist id={listId}>
            <option value="SMC" />
            <option value="ICT" />
            <option value="BREAKOUT" />
            <option value="SCALPING" />
            <option value="TREND FOLLOWING" />
            <option value="REVERSAL" />
          </datalist>
        )}
        {listId === 'mistakes-options-table' && (
          <datalist id={listId}>
            <option value="FOMO" />
            <option value="Revenge Trading" />
            <option value="Moved Stop Loss" />
            <option value="Overleveraged" />
            <option value="Ignored Rules" />
            <option value="Hesitated" />
          </datalist>
        )}
      </td>
    );
  }

  return (
    <td
      onClick={onStartEdit}
      className={`px-4 py-3 cursor-pointer hover:bg-white/10 transition-colors ${className}`}
    >
      {formatter(value)}
    </td>
  );
};

// ─── Screenshot Cell ──────────────────────────────────────────────────────────
function ScreenshotCell({
  tradeId,
  screenshot,
  onLightbox,
}: {
  tradeId:    number;
  screenshot: string | undefined;
  onLightbox: (src: string) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      await db.trades.update(tradeId, { screenshot: compressed });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <td className="px-3 py-2 text-center">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        title="Upload screenshot"
      />

      {screenshot ? (
        <div className="relative inline-block group">
          <img
            src={screenshot}
            alt="Chart screenshot"
            className="w-14 h-10 object-cover rounded border border-white/10 group-hover:border-white transition-colors cursor-zoom-in"
            onClick={() => onLightbox(screenshot)}
          />
          {/* View overlay */}
          <div
            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1 cursor-zoom-in"
            onClick={e => { e.stopPropagation(); onLightbox(screenshot); }}
          >
            <ZoomIn size={14} className="text-white" />
          </div>
          {/* Delete screenshot */}
          <button
            onClick={e => { e.stopPropagation(); db.trades.update(tradeId, { screenshot: undefined }); }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black border border-neonRed/50 hover:bg-neonRed rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove screenshot"
          >
            <X size={8} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach screenshot"
          className="w-10 h-8 rounded border border-dashed border-gray-700 hover:border-white text-gray-600 hover:text-white flex items-center justify-center transition-all mx-auto"
        >
          <Camera size={14} />
        </button>
      )}
    </td>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────
export default function TradeTable({ strategyFilter = [] }: { strategyFilter?: string[] }) {
  const userId = parseInt(localStorage.getItem('trading_user_id') || '1');

  const allTrades = useLiveQuery(
    () => db.trades.where('userId').equals(userId).toArray(),
    [userId]
  );

  const trades = React.useMemo(() => {
    if (!allTrades) return null;
    return strategyFilter.length > 0 ? allTrades.filter(t => strategyFilter.includes(t.strategy)) : allTrades;
  }, [allTrades, strategyFilter]);

  const strategyWinRates = React.useMemo(() => {
    if (!allTrades) return {};
    const stats: Record<string, { wins: number, total: number }> = {};
    allTrades.forEach(t => {
      const s = t.strategy || 'Uncategorized';
      if (!stats[s]) stats[s] = { wins: 0, total: 0 };
      stats[s].total += 1;
      if (t.status === 'WIN') stats[s].wins += 1;
    });
    const result: Record<string, number> = {};
    for (const s in stats) {
      result[s] = Math.round((stats[s].wins / stats[s].total) * 100);
    }
    return result;
  }, [allTrades]);

  const [filter,      setFilter]      = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [sortConfig,  setSortConfig]  = React.useState<{ key: keyof Trade; direction: 'asc' | 'desc' } | null>({ key: 'entryDate', direction: 'desc' });
  const [editingCell, setEditingCell] = React.useState<{ id: number; field: keyof Trade } | null>(null);
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!trades) return <div className="text-white p-4">Loading trades...</div>;

  // ── Cell update ──
  const handleCellUpdate = async (id: number, field: keyof Trade, value: any) => {
    try {
      await db.trades.update(id, { [field]: value });
      setEditingCell(null);
    } catch (err) {
      console.error('Failed to update trade:', err);
    }
  };

  // ── Filter + Sort ──
  let filteredTrades = [...trades].filter(t =>
    t.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    t.strategy.toLowerCase().includes(filter.toLowerCase())
  );

  if (sortConfig) {
    filteredTrades.sort((a, b) => {
      let aVal: any = a[sortConfig.key];
      let bVal: any = b[sortConfig.key];
      if (aVal === undefined || bVal === undefined) return 0;
      // Parse dates as timestamps for correct numeric comparison
      if (sortConfig.key === 'entryDate' || sortConfig.key === 'exitDate') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ?  1 : -1;
      return 0;
    });
  }

  const handleSort = (key: keyof Trade) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // ── Selection ──
  const handleSelect    = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleSelectAll = () =>
    setSelectedIds(
      selectedIds.length === filteredTrades.length && filteredTrades.length > 0
        ? []
        : filteredTrades.map(t => t.id!).filter(Boolean)
    );

  // ── Bulk / single delete ──
  const handleBulkDelete = async () => {
    if (selectedIds.length > 0 && window.confirm(`Delete ${selectedIds.length} selected trades?`)) {
      await db.trades.bulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleDelete = async (id?: number) => {
    if (id && window.confirm('Delete this trade?')) await db.trades.delete(id);
  };

  // ── Excel ──
  const handleExport = () => { if (trades) exportTradesToExcel(trades); };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedData = await importTradesFromExcel(file);
      const newTrades    = importedData.map(t => ({
        ...t,
        userId,
        entryDate: t.entryDate || new Date().toISOString(),
        status:    t.status || 'OPEN',
      })) as Trade[];
      await db.trades.bulkAdd(newTrades);
      alert(`✅ ${newTrades.length} trades imported successfully!`);
    } catch (err) {
      console.error(err);
      alert('❌ Failed to import trades. Please check the file format.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Quick add ──
  const handleAddRow = async () => {
    const newId = await db.trades.add({
      userId,
      symbol:    'NEW',
      direction: 'BUY',
      strategy:  'Strategy',
      entryPrice: 0,
      stopLoss:   0,
      takeProfit: 0,
      lotSize:    0.01,
      entryDate:  new Date().toISOString(),
      status:     'OPEN',
      pnl:        0,
      notes:      '',
      mistakes:   '',
    });
    setEditingCell({ id: newId as number, field: 'symbol' });
  };

  const sortIndicator = (key: keyof Trade) =>
    sortConfig?.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="premium-card premium-glow mt-8 relative z-10">

        {/* Toolbar */}
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-center bg-black/40 gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="text-trade-history" size={24} />
              <h2 className="text-xl font-orbitron font-bold text-trade-history glow-trade-history">TRADE HISTORY</h2>
            </div>
            <button
              onClick={handleAddRow}
              className="hidden md:block px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] rounded border border-white/30 transition-all uppercase font-bold tracking-tighter"
            >
              + Quick Add
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Filter trades..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-black/50 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white w-40"
              aria-label="Filter trades"
            />

            <div className="flex items-center space-x-2">
              {selectedIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-1 bg-neonRed/20 hover:bg-neonRed text-neonRed hover:text-black border border-neonRed/30 px-3 py-1.5 rounded text-xs transition-all mr-2"
                >
                  <Trash2 size={14} />
                  <span>DELETE ({selectedIds.length})</span>
                </button>
              )}

              <button
                onClick={handleExport}
                className="flex items-center space-x-1 bg-neonGreen/10 hover:bg-neonGreen/20 border border-neonGreen/30 text-neonGreen px-3 py-1.5 rounded text-xs transition-colors"
                title="Export to Excel (.xlsx)"
              >
                <Download size={14} />
                <span className="hidden sm:inline">EXPORT</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1.5 rounded text-xs transition-colors"
                title="Import from Excel (.xlsx)"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">IMPORT</span>
              </button>

              <input
                id="import-excel"
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                title="Select Excel file to import"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-black/60 text-gray-400 font-inter">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredTrades.length && filteredTrades.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-700 bg-black/50 text-white focus:ring-white"
                    aria-label="Select all trades"
                  />
                </th>
                <th onClick={() => handleSort('entryDate')} className="px-4 py-3 cursor-pointer hover:text-white whitespace-nowrap">
                  Date{sortIndicator('entryDate')}
                </th>
                <th onClick={() => handleSort('symbol')} className="px-4 py-3 cursor-pointer hover:text-white">
                  Symbol{sortIndicator('symbol')}
                </th>
                <th onClick={() => handleSort('direction')} className="px-4 py-3 cursor-pointer hover:text-white">
                  Dir{sortIndicator('direction')}
                </th>
                <th onClick={() => handleSort('strategy')} className="px-4 py-3 cursor-pointer hover:text-white">
                  Strategy{sortIndicator('strategy')}
                </th>
                <th onClick={() => handleSort('mistakes')} className="px-4 py-3 cursor-pointer hover:text-white">
                  Mistakes{sortIndicator('mistakes')}
                </th>
                <th onClick={() => handleSort('entryPrice')} className="px-4 py-3 cursor-pointer hover:text-white">
                  Entry{sortIndicator('entryPrice')}
                </th>
                <th onClick={() => handleSort('pnl')} className="px-4 py-3 cursor-pointer hover:text-white">
                  P&L{sortIndicator('pnl')}
                </th>
                <th onClick={() => handleSort('marketMovement')} className="px-4 py-3 cursor-pointer hover:text-white whitespace-nowrap">
                  Mkt Move{sortIndicator('marketMovement')}
                </th>
                <th onClick={() => handleSort('capturedMovement')} className="px-4 py-3 cursor-pointer hover:text-white whitespace-nowrap">
                  Captured{sortIndicator('capturedMovement')}
                </th>
                <th className="px-4 py-3 text-white">
                  Eff %
                </th>
                <th className="px-4 py-3 text-white">
                  Rules
                </th>
                <th className="px-4 py-3 text-white">
                  R:R
                </th>
                <th className="px-4 py-3 text-white">
                  Win Rate
                </th>
                <th onClick={() => handleSort('status')} className="px-4 py-3 cursor-pointer hover:text-white">
                  Status{sortIndicator('status')}
                </th>
                <th className="px-3 py-3 text-center text-white">📷</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredTrades.map(trade => (
                <tr
                  key={trade.id}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${selectedIds.includes(trade.id!) ? 'bg-white/5' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(trade.id!)}
                      onChange={() => handleSelect(trade.id!)}
                      className="rounded border-gray-700 bg-black/50 text-white focus:ring-white"
                      aria-label={`Select trade ${trade.symbol}`}
                    />
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    <div className="flex flex-col space-y-1">
                      <EditableCell
                        value={new Date(new Date(trade.entryDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                        type="datetime-local"
                        onSave={val => handleCellUpdate(trade.id!, 'entryDate', new Date(val).toISOString())}
                        isEditing={editingCell?.id === trade.id && editingCell?.field === 'entryDate'}
                        onStartEdit={() => setEditingCell({ id: trade.id!, field: 'entryDate' })}
                        className="text-gray-400 font-bold"
                        formatter={val => new Date(val).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      />
                      <EditableCell
                        value={trade.exitDate ? new Date(new Date(trade.exitDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                        type="datetime-local"
                        onSave={val => handleCellUpdate(trade.id!, 'exitDate', val ? new Date(val).toISOString() : undefined)}
                        isEditing={editingCell?.id === trade.id && editingCell?.field === 'exitDate'}
                        onStartEdit={() => setEditingCell({ id: trade.id!, field: 'exitDate' })}
                        className="text-gray-500 text-[10px]"
                        formatter={val => val ? `Out: ${new Date(val).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : 'Add Exit'}
                      />
                    </div>
                  </td>

                  {/* Symbol */}
                  <EditableCell
                    value={trade.symbol}
                    onSave={val => handleCellUpdate(trade.id!, 'symbol', val.toUpperCase())}
                    isEditing={editingCell?.id === trade.id && editingCell?.field === 'symbol'}
                    onStartEdit={() => setEditingCell({ id: trade.id!, field: 'symbol' })}
                    className="font-bold text-white"
                  />

                  {/* Direction toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleCellUpdate(trade.id!, 'direction', trade.direction === 'BUY' ? 'SELL' : 'BUY')}
                      className={`px-2 py-1 rounded text-xs font-bold transition-all ${trade.direction === 'BUY' ? 'bg-neonGreen/20 text-neonGreen hover:bg-neonGreen/30' : 'bg-neonRed/20 text-neonRed hover:bg-neonRed/30'}`}
                    >
                      {trade.direction}
                    </button>
                  </td>

                  {/* Strategy - colored badge */}
                  {editingCell?.id === trade.id && editingCell?.field === 'strategy' ? (
                    <EditableCell
                      value={trade.strategy}
                      onSave={val => handleCellUpdate(trade.id!, 'strategy', val)}
                      isEditing={true}
                      onStartEdit={() => setEditingCell({ id: trade.id!, field: 'strategy' })}
                      listId="strategy-options-table"
                    />
                  ) : (
                    <td
                      onClick={() => setEditingCell({ id: trade.id!, field: 'strategy' })}
                      className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      {trade.strategy ? (
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight whitespace-nowrap ${getStrategyClass(trade.strategy)}`}
                        >
                          {trade.strategy}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs italic">—</span>
                      )}
                    </td>
                  )}

                  {/* Mistakes */}
                  <EditableCell
                    value={trade.mistakes || ''}
                    onSave={val => handleCellUpdate(trade.id!, 'mistakes', val)}
                    isEditing={editingCell?.id === trade.id && editingCell?.field === 'mistakes'}
                    onStartEdit={() => setEditingCell({ id: trade.id!, field: 'mistakes' })}
                    listId="mistakes-options-table"
                    className="text-neonRed text-xs"
                  />

                  {/* Entry price */}
                  <EditableCell
                    value={trade.entryPrice}
                    type="number"
                    onSave={val => handleCellUpdate(trade.id!, 'entryPrice', parseFloat(val))}
                    isEditing={editingCell?.id === trade.id && editingCell?.field === 'entryPrice'}
                    onStartEdit={() => setEditingCell({ id: trade.id!, field: 'entryPrice' })}
                  />

                  <EditableCell
                    value={trade.pnl || 0}
                    type="number"
                    onSave={val => handleCellUpdate(trade.id!, 'pnl', parseFloat(val))}
                    isEditing={editingCell?.id === trade.id && editingCell?.field === 'pnl'}
                    onStartEdit={() => setEditingCell({ id: trade.id!, field: 'pnl' })}
                    className={`font-bold ${trade.pnl && trade.pnl > 0 ? 'text-neonGreen' : trade.pnl && trade.pnl < 0 ? 'text-neonRed' : 'text-gray-400'}`}
                    formatter={val => {
                      const num = parseFloat(val) || 0;
                      if (num > 0) return `+$${num.toFixed(2)}`;
                      if (num < 0) return `-$${Math.abs(num).toFixed(2)}`;
                      return `$0.00`;
                    }}
                  />

                  {/* Market Move */}
                  <EditableCell
                    value={trade.marketMovement || 0}
                    type="number"
                    onSave={val => handleCellUpdate(trade.id!, 'marketMovement', parseFloat(val))}
                    isEditing={editingCell?.id === trade.id && editingCell?.field === 'marketMovement'}
                    onStartEdit={() => setEditingCell({ id: trade.id!, field: 'marketMovement' })}
                    className="text-gray-400"
                  />

                  {/* Captured Move */}
                  <EditableCell
                    value={trade.capturedMovement || 0}
                    type="number"
                    onSave={val => handleCellUpdate(trade.id!, 'capturedMovement', parseFloat(val))}
                    isEditing={editingCell?.id === trade.id && editingCell?.field === 'capturedMovement'}
                    onStartEdit={() => setEditingCell({ id: trade.id!, field: 'capturedMovement' })}
                    className="text-white font-bold"
                  />

                  {/* Efficiency % */}
                  <td className="px-4 py-3 text-xs font-bold">
                    {trade.marketMovement && trade.marketMovement > 0 ? (
                      <span className={((trade.capturedMovement || 0) / trade.marketMovement) > 0.7 ? 'text-neonGreen' : 'text-white'}>
                        {((trade.capturedMovement || 0) / trade.marketMovement * 100).toFixed(0)}%
                      </span>
                    ) : '0%'}
                  </td>

                  {/* Rules Adhered */}
                  <td className="px-4 py-3">
                    {trade.rulesAdhered && trade.rulesAdhered.length > 0 ? (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white font-bold uppercase">{trade.rulesAdhered.length} Rules Met</span>
                        <div className="flex space-x-0.5 mt-1">
                          {trade.rulesAdhered.map((_, i) => (
                            <div key={i} className="w-1.5 h-1.5 bg-white rounded-full" />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 uppercase">No Rules</span>
                    )}
                  </td>

                  {/* R:R */}
                  <td className="px-4 py-3 text-xs font-bold text-gray-400">
                    {trade.entryPrice && trade.stopLoss && trade.takeProfit ? (
                      (() => {
                        const risk = Math.abs(trade.entryPrice - trade.stopLoss);
                        const reward = Math.abs(trade.takeProfit - trade.entryPrice);
                        return risk > 0 ? `1:${(reward / risk).toFixed(2)}` : '-';
                      })()
                    ) : '-'}
                  </td>

                  {/* Dynamic Win Rate + BOS */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${strategyWinRates[trade.strategy || 'Uncategorized'] > 70 ? 'bg-neonGreen' : strategyWinRates[trade.strategy || 'Uncategorized'] > 40 ? 'bg-white' : 'bg-neonRed'} w-pct-${strategyWinRates[trade.strategy || 'Uncategorized'] || 0}`}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#FBBF24]">{strategyWinRates[trade.strategy || 'Uncategorized'] || 0}%</span>
                    </div>
                    {trade.bos && trade.bos !== 'NONE' && (
                      <div className={`text-[8px] font-bold mt-0.5 ${trade.bos === 'BULLISH' ? 'text-white' : 'text-gray-400'}`}>
                        BOS: {trade.bos}
                      </div>
                    )}
                  </td>

                  {/* Status toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        const next = trade.status === 'OPEN' ? 'WIN' : trade.status === 'WIN' ? 'LOSS' : 'OPEN';
                        handleCellUpdate(trade.id!, 'status', next);
                      }}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        trade.status === 'WIN'  ? 'border border-neonGreen text-neonGreen hover:bg-neonGreen/10' :
                        trade.status === 'LOSS' ? 'border border-neonRed   text-neonRed   hover:bg-neonRed/10'  :
                        'border border-gray-500 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {trade.status}
                    </button>
                  </td>

                  {/* Screenshot cell */}
                  <ScreenshotCell
                    tradeId={trade.id!}
                    screenshot={trade.screenshot}
                    onLightbox={setLightboxSrc}
                  />

                  {/* Delete */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(trade.id)}
                      className="text-gray-500 hover:text-neonRed transition-colors"
                      title="Delete trade"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredTrades.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    No trades found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
