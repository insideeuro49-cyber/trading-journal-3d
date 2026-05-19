import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { db } from '../Database';
import { useLiveQuery } from 'dexie-react-hooks';
import TradeTable from '../components/TradeTable';
import TradeEntry from '../components/TradeEntry';
import ThreeBackground from '../components/ThreeBackground';
import Navbar from '../components/Navbar';
import { Plus, Download } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { exportWeeklyMistakesPDF, exportMonthlyReportPDF } from '../utils/pdf';
import {
  getStrategyFilterClass,
  getStrategyCardClass,
  getStrategyGradientClass,
  getStrategyTextClass,
  getStrategyBgClass
} from '../utils/strategyColors';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface StrategyStat {
  name: string;
  trades: number;
  wins: number;
  pnl: number;
  totalRR: number;
  rrCount: number;
  totalMarket: number;
  totalCaptured: number;
  adherenceCount: number;
  winRate: string;
  avgRR: string;
  efficiency: string;
  discipline: string;
}

interface HourStat {
  hour: string;
  wins: number;
  losses: number;
  total: number;
}

interface DayStat {
  day: string;
  strategy: string;
  totalRR: number;
  rrCount: number;
  wins: number;
  losses: number;
  total: number;
  avgRR: number;
}

interface MonthlyReport {
  month: string;
  mistakes: string[];
  strategies: Record<string, any>;
  totalPnl: number;
  trades: number;
  wins: number;
}

interface TiltCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
  isDanger?: boolean;
  isGolden?: boolean;
  isNavy?: boolean;
  children?: React.ReactNode;
}

// ─── Components ──────────────────────────────────────────────────────────────
const TiltCard = ({ title, value, subtitle, color, isDanger = false, isGolden = false, isNavy = false, children }: TiltCardProps) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
        background: `linear-gradient(to bottom right, ${color}10, transparent), rgba(0,0,0,0.6)`
      }}
      className={`relative glass-panel rounded-xl p-6 border ${isDanger ? 'border-red-500/50 hover:border-red-500' : 'border-white/20 hover:border-white/60'} transition-all duration-300 overflow-hidden group shadow-[0_10px_30px_rgba(0,0,0,0.5)]`}
    >
      <div 
        className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-[50px] pointer-events-none bg-white`}
      ></div>
      
      <div className="transform-z-50">
        <h3 className="text-gray-400 text-sm font-bold tracking-wider font-inter">{title}</h3>
        <div className={`text-3xl font-orbitron font-bold mt-2 ${isDanger ? 'text-neonRed text-glow' : isGolden ? 'text-[#FBBF24] text-glow' : isNavy ? 'text-[#1E3A8A] text-glow' : 'text-slate-800'}`}>
          {value}
        </div>
        <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
        <div className="mt-4">{children}</div>
      </div>
    </motion.div>
  );
};

export default function Dashboard({ setAuth }: { setAuth: (val: boolean) => void }) {
  const [time, setTime] = useState(new Date());
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const userId = parseInt(localStorage.getItem('trading_user_id') || '1');

  const trades = useLiveQuery(
    () => db.trades.where('userId').equals(userId).toArray(),
    [userId]
  );

  const strategiesFromDb = useLiveQuery(
    () => db.strategies.where('userId').equals(userId).toArray(),
    [userId]
  );

  const [editingRulesFor, setEditingRulesFor] = useState<string | null>(null);
  const [newRule, setNewRule] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 50); // Fast interval for ms
    return () => clearInterval(timer);
  }, []);

  // Get unique strategies for the filter
  const allUniqueStrategies = Array.from(new Set([
    ...(trades?.map(t => t.strategy).filter(Boolean) || []),
    ...(strategiesFromDb?.map(s => s.name) || [])
  ])) as string[];

  // Filtered trades based on selection
  const filteredTrades = trades?.filter(t => 
    selectedStrategies.length === 0 || selectedStrategies.includes(t.strategy)
  ) || [];

  // Metrics Calculation
  const totalTrades = filteredTrades.length;
  const wins = filteredTrades.filter(t => t.status === 'WIN').length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnl = filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  
  // Strategy stats aggregation
  const strategyStatsAccumulator: Record<string, any> = {};
  const strategyStats = trades?.reduce((acc, trade) => {
    const s = trade.strategy || 'Uncategorized';
    if (!acc[s]) {
      acc[s] = { name: s, trades: 0, wins: 0, pnl: 0, totalRR: 0, rrCount: 0, totalMarket: 0, totalCaptured: 0, adherenceCount: 0 };
    }
    acc[s].trades += 1;
    if (trade.status === 'WIN') acc[s].wins += 1;
    acc[s].pnl += (trade.pnl || 0);
    acc[s].totalMarket += (trade.marketMovement || 0);
    acc[s].totalCaptured += (trade.capturedMovement || 0);

    // Adherence logic
    const stratRules = strategiesFromDb?.find(st => st.name === s)?.rules || [];
    if (stratRules.length > 0 && trade.rulesAdhered) {
      acc[s].adherenceCount += (trade.rulesAdhered.length / stratRules.length);
    }

    // Calculate planned R:R
    if (trade.entryPrice && trade.stopLoss && trade.takeProfit) {
      const risk = Math.abs(trade.entryPrice - trade.stopLoss);
      const reward = Math.abs(trade.takeProfit - trade.entryPrice);
      if (risk > 0) {
        acc[s].totalRR += (reward / risk);
        acc[s].rrCount += 1;
      }
    }

    return acc;
  }, strategyStatsAccumulator) || {};

  const strategyStatsArray: StrategyStat[] = Object.values(strategyStats).map((s: any) => ({
    ...s,
    winRate: s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(1) : '0.0',
    avgRR: s.rrCount > 0 ? (s.totalRR / s.rrCount).toFixed(2) : '0.00',
    efficiency: s.totalMarket > 0 ? ((s.totalCaptured / s.totalMarket) * 100).toFixed(0) : '0',
    discipline: s.trades > 0 ? (s.adherenceCount / s.trades * 100).toFixed(0) : '0'
  }));

  // Best Strategy Finder
  const bestRRStrategy = [...strategyStatsArray].sort((a, b) => parseFloat(b.avgRR) - parseFloat(a.avgRR))[0];
  const mostEfficientStrategy = [...strategyStatsArray].sort((a, b) => parseFloat(b.efficiency) - parseFloat(a.efficiency))[0];

  const handleAddRule = async (strategyName: string) => {
    if (!newRule.trim()) return;
    const existing = strategiesFromDb?.find(s => s.name === strategyName);
    if (existing) {
      await db.strategies.update(existing.id!, { rules: [...existing.rules, newRule] });
    } else {
      await db.strategies.add({ userId, name: strategyName, rules: [newRule] });
    }
    setNewRule('');
  };

  const handleRemoveRule = async (strategyName: string, ruleToRemove: string) => {
    const existing = strategiesFromDb?.find(s => s.name === strategyName);
    if (existing) {
      await db.strategies.update(existing.id!, { rules: existing.rules.filter(r => r !== ruleToRemove) });
    }
  };

  const handleRenameStrategy = async (oldName: string) => {
    const newName = window.prompt('Enter new strategy name:', oldName);
    if (!newName || newName === oldName) return;
    
    // Update all trades with this strategy
    const tradeIds = trades?.filter(t => t.strategy === oldName).map(t => t.id!) || [];
    if (tradeIds.length > 0) {
      await Promise.all(tradeIds.map(id => db.trades.update(id, { strategy: newName })));
    }
    
    // Update strategy definition if it exists
    const strat = strategiesFromDb?.find(s => s.name === oldName);
    if (strat) {
      await db.strategies.update(strat.id!, { name: newName });
    }
  };

  // Chart Data
  const equityCurve = filteredTrades.map((t, i) => {
    const previous = i > 0 ? filteredTrades.slice(0, i).reduce((sum, tr) => sum + (tr.pnl || 0), 0) : 0;
    return { name: `Trade ${i+1}`, value: previous + (t.pnl || 0) };
  });

  const COLORS = ['#4F46E5', '#10B981', '#FBBF24', '#EF4444', '#6366F1', '#34D399', '#FCD34D', '#F87171'];

  const monthlyPnLData = filteredTrades.reduce((acc: any[], trade) => {
    const date = new Date(trade.entryDate);
    const month = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear().toString().substring(2);
    const existing = acc.find(a => a.month === month);
    if (existing) {
      existing.pnl += (trade.pnl || 0);
    } else {
      acc.push({ month, pnl: trade.pnl || 0 });
    }
    return acc;
  }, []);

  const monthlyFullStatsAccumulator: Record<string, MonthlyReport> = {};
  const monthlyFullStats = trades?.reduce((acc, trade) => {
    const date = new Date(trade.entryDate);
    const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!acc[month]) {
      acc[month] = { 
        month, 
        mistakes: [] as string[], 
        strategies: {} as any,
        totalPnl: 0,
        trades: 0,
        wins: 0
      };
    }
    
    acc[month].totalPnl += (trade.pnl || 0);
    acc[month].trades += 1;
    if (trade.status === 'WIN') acc[month].wins += 1;
    if (trade.mistakes) acc[month].mistakes.push(trade.mistakes);
    
    const s = trade.strategy || 'Uncategorized';
    if (!acc[month].strategies[s]) {
      acc[month].strategies[s] = { name: s, totalTrades: 0, wins: 0, losses: 0, pnl: 0, market: 0, captured: 0, rrTotal: 0, rrCount: 0 };
    }
    acc[month].strategies[s].totalTrades += 1;
    if (trade.status === 'WIN') acc[month].strategies[s].wins += 1;
    if (trade.status === 'LOSS') acc[month].strategies[s].losses += 1;
    acc[month].strategies[s].pnl += (trade.pnl || 0);
    acc[month].strategies[s].market += (trade.marketMovement || 0);
    acc[month].strategies[s].captured += (trade.capturedMovement || 0);
    
    if (trade.entryPrice && trade.stopLoss && trade.takeProfit) {
      const risk = Math.abs(trade.entryPrice - trade.stopLoss);
      const reward = Math.abs(trade.takeProfit - trade.entryPrice);
      if (risk > 0) {
        acc[month].strategies[s].rrTotal += (reward / risk);
        acc[month].strategies[s].rrCount += 1;
      }
    }

    return acc;
  }, monthlyFullStatsAccumulator) || {};

  const monthlyReportArray = Object.values(monthlyFullStats).sort((a: MonthlyReport, b: MonthlyReport) => {
    return new Date(b.month).getTime() - new Date(a.month).getTime();
  });

  const dayOfWeekStatsAccumulator: Record<string, any> = {};
  const dayOfWeekStats = trades?.reduce((acc, trade) => {
    const day = new Date(trade.entryDate).toLocaleString('en-US', { weekday: 'long' });
    const s = trade.strategy || 'Uncategorized';
    const key = `${day}-${s}`;
    if (!acc[key]) acc[key] = { day, strategy: s, totalRR: 0, rrCount: 0, wins: 0, losses: 0, total: 0 };
    
    acc[key].total += 1;
    if (trade.status === 'WIN') acc[key].wins += 1;
    if (trade.status === 'LOSS') acc[key].losses += 1;
    
    if (trade.entryPrice && trade.stopLoss && trade.takeProfit) {
      const risk = Math.abs(trade.entryPrice - trade.stopLoss);
      const reward = Math.abs(trade.takeProfit - trade.entryPrice);
      if (risk > 0) {
        acc[key].totalRR += (reward / risk);
        acc[key].rrCount += 1;
      }
    }
    return acc;
  }, dayOfWeekStatsAccumulator) || {};

  const dayOfWeekStatsArray: DayStat[] = Object.values(dayOfWeekStats).map((d: any) => ({
    ...d,
    avgRR: d.rrCount > 0 ? d.totalRR / d.rrCount : 0
  }));

  const bestDayStrategy = [...dayOfWeekStatsArray].sort((a, b) => b.avgRR - a.avgRR)[0];
  const worstDayStrategy = [...dayOfWeekStatsArray].sort((a, b) => b.losses - a.losses)[0];

  const hourStatsAccumulator: Record<string, HourStat> = {};
  const hourStats = trades?.reduce((acc, trade) => {
    const hour = new Date(trade.entryDate).getHours();
    const label = `${hour}:00`;
    if (!acc[label]) acc[label] = { hour: label, wins: 0, losses: 0, total: 0 };
    acc[label].total += 1;
    if (trade.status === 'WIN') acc[label].wins += 1;
    if (trade.status === 'LOSS') acc[label].losses += 1;
    return acc;
  }, hourStatsAccumulator) || {};

  const timeStatsArray: HourStat[] = Object.values(hourStats).sort((a: HourStat, b: HourStat) => parseInt(a.hour) - parseInt(b.hour));
  const bestHour: HourStat | undefined = [...timeStatsArray].sort((a: HourStat, b: HourStat) => (b.wins/b.total) - (a.wins/a.total))[0];
  const worstHour: HourStat | undefined = [...timeStatsArray].sort((a: HourStat, b: HourStat) => (b.losses/b.total) - (a.losses/a.total))[0];

  return (
    <div className="min-h-screen bg-black text-slate-800 relative">
      <ThreeBackground />
      <Navbar setAuth={setAuth} />
      
      <main className="max-w-7xl mx-auto px-4 py-12 relative z-10">
        {/* Real-time Intel Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-1 w-12 bg-slate-800 rounded-full" />
              <span className="text-xs font-orbitron tracking-[0.5em] text-slate-800">SYSTEM ONLINE</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-orbitron font-black tracking-tighter leading-none">
              TRADING <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">JOURNAL</span>
            </h1>
          </motion.div>

          <div className="flex flex-col items-end">
            <div className="text-right mb-4">
              <div className="text-[10px] font-orbitron text-gray-500 tracking-widest uppercase">System Chronometer</div>
              <div className="text-3xl font-orbitron font-bold text-slate-800 tabular-nums">
                {time.toLocaleTimeString([], { hour12: false })}<span className="text-sm opacity-50 ml-1">:{time.getMilliseconds().toString().padStart(3, '0')}</span>
              </div>
            </div>
            <button
              onClick={() => setIsEntryOpen(true)}
              className="group relative px-10 py-4 bg-slate-800 text-black font-orbitron font-bold text-sm tracking-[0.2em] rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:shadow-[0_0_50px_rgba(255,255,255,0.6)]"
            >
              <div className="flex items-center space-x-3">
                <Plus size={20} strokeWidth={3} />
                <span>NEW TRADE</span>
              </div>
            </button>
          </div>
        </div>

        {/* Intelligence Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedStrategies([])}
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all border ${selectedStrategies.length === 0 ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
            ALL STRATEGIES
          </button>
          {allUniqueStrategies.map(strat => {
            const isActive = selectedStrategies.includes(strat);
            return (
              <button
                key={strat}
                onClick={() => {
                  if (isActive) {
                    setSelectedStrategies(selectedStrategies.filter(s => s !== strat));
                  } else {
                    setSelectedStrategies([...selectedStrategies, strat]);
                  }
                }}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all border hover:opacity-100 ${getStrategyFilterClass(strat, isActive)}`}
              >
                {strat}
              </button>
            );
          })}
        </div>

        {/* Global Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <TiltCard
            title="TOTAL P&L"
            value={`$${totalPnl.toFixed(2)}`}
            subtitle={`${totalTrades} total trades analyzed`}
            color="#FFFFFF"
            isDanger={totalPnl < 0}
          >
            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '70%' }}
                className={`h-full ${totalPnl >= 0 ? 'bg-slate-800' : 'bg-neonRed'}`}
              />
            </div>
          </TiltCard>

          <TiltCard
            title="WIN RATE"
            value={`${winRate}%`}
            subtitle={`${wins} successful executions`}
            color="#FFFFFF"
            isGolden={true}
          >
            <div className="flex space-x-1 mt-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className={`h-4 w-2 rounded-sm ${i < parseFloat(winRate) / 10 ? 'bg-slate-800' : 'bg-gray-800'}`} />
              ))}
            </div>
          </TiltCard>

          <TiltCard
            title="BEST STRATEGY"
            value={bestRRStrategy?.name.toUpperCase() || 'N/A'}
            subtitle={`Average R:R 1:${bestRRStrategy?.avgRR || '0.00'}`}
            color="#FFFFFF"
            isNavy={true}
          >
            <div className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tighter">
              Performance Edge: <span className="text-[#FBBF24]">{bestRRStrategy?.winRate || 0}% Win Rate</span>
            </div>
          </TiltCard>

          <TiltCard
            title="MARKET EFFICIENCY"
            value={mostEfficientStrategy?.name.toUpperCase() || 'N/A'}
            subtitle={`${mostEfficientStrategy?.efficiency || 0}% capture rate`}
            color="#FFFFFF"
          >
            <div className="flex items-center space-x-2 mt-2">
              <div className="text-xs font-bold text-slate-800">{mostEfficientStrategy?.discipline || 0}%</div>
              <div className="text-[8px] text-gray-500 font-bold uppercase">Rule Adherence</div>
            </div>
          </TiltCard>
        </div>

        {/* Visual Intelligence Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 premium-card premium-glow p-6">
            <h3 className="font-orbitron font-bold text-slate-800 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse" />
              EQUITY CURVE
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#333" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#333" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#FFFFFF', borderRadius: '8px', boxShadow: '0 0 10px rgba(255,255,255,0.2)' }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#4F46E5" 
                    fillOpacity={1}
                    fill="url(#colorValue)" 
                    strokeWidth={3} 
                    activeDot={{ r: 8, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }} 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="premium-card premium-glow p-6">
            <h3 className="font-orbitron font-bold text-slate-800 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse" />
              STRATEGY MIX
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={strategyStatsArray} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="trades">
                    {strategyStatsArray.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {strategyStatsArray.map((entry, index) => {
                const colorClasses = [
                  'bg-[#4F46E5]', 'bg-[#10B981]', 'bg-[#FBBF24]', 'bg-[#EF4444]',
                  'bg-[#6366F1]', 'bg-[#34D399]', 'bg-[#FCD34D]', 'bg-[#F87171]'
                ];
                return (
                  <div key={entry.name} className="flex items-center text-xs text-gray-400">
                    <div className={`w-3 h-3 rounded-full mr-1 ${colorClasses[index % colorClasses.length]}`}></div>
                    {entry.name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Strategy Performance Breakdown */}
        <div className="premium-card premium-glow p-6 mt-8 relative z-10">
          <h3 className="font-orbitron font-bold text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse" />
            STRATEGY INTELLIGENCE BREAKDOWN
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategyStatsArray.map((stat: StrategyStat) => {
              return (
              <div key={stat.name} className={`premium-card p-5 group relative overflow-hidden bg-black/60 ${getStrategyCardClass(stat.name)}`}>
                <div className={`absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity ${getStrategyGradientClass(stat.name)}`} />
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                  <button 
                    onClick={() => setEditingRulesFor(editingRulesFor === stat.name ? null : stat.name)}
                    className="text-[8px] font-bold text-gray-500 hover:text-slate-800 uppercase tracking-tighter"
                  >
                    Rules
                  </button>
                  <button 
                    onClick={() => handleRenameStrategy(stat.name)}
                    className="text-[8px] font-bold text-gray-500 hover:text-slate-800 uppercase tracking-tighter"
                  >
                    Rename
                  </button>
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className={`font-orbitron font-bold text-lg group-hover:transition-colors ${getStrategyTextClass(stat.name)}`}>{stat.name.toUpperCase()}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{stat.trades} TOTAL TRADES</p>
                  </div>
                  <div className={`text-xl font-orbitron font-bold ${stat.pnl > 0 ? 'text-neonGreen' : stat.pnl < 0 ? 'text-neonRed' : 'text-gray-400'}`}>
                    {stat.pnl > 0 ? `+$${stat.pnl.toFixed(2)}` : stat.pnl < 0 ? `-$${Math.abs(stat.pnl).toFixed(2)}` : `$0.00`}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-gray-400">CAPTURE EFFICIENCY</span>
                      <span className="text-slate-800">{stat.efficiency}%</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                      <div className={`bg-slate-800 h-full w-pct-${Math.round(parseFloat(stat.efficiency))}`}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t text-slate-800/5">
                    <div>
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">Avg R:R</span>
                      <span className="text-[11px] font-bold text-slate-800">1:{stat.avgRR}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">Discipline</span>
                      <span className="text-[11px] font-bold text-slate-800">{stat.discipline}%</span>
                    </div>
                  </div>

                  {editingRulesFor === stat.name && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="pt-4 border-t text-slate-800/5"
                    >
                      <label className="block text-[8px] text-slate-800 font-bold mb-2 uppercase">Checklist Rules</label>
                      <div className="space-y-2 mb-3">
                        {strategiesFromDb?.find(s => s.name === stat.name)?.rules.map(rule => (
                          <div key={rule} className="flex justify-between items-center bg-black/20 p-1.5 rounded text-[10px]">
                            <span className="text-gray-300">{rule}</span>
                            <button onClick={() => handleRemoveRule(stat.name, rule)} className="text-slate-800 hover:text-slate-800">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex space-x-1">
                        <input 
                          type="text" 
                          value={newRule}
                          onChange={e => setNewRule(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddRule(stat.name); }}
                          placeholder="New rule..."
                          className="flex-1 bg-black/50 border text-slate-800/10 rounded px-2 py-1 text-[10px] outline-none focus:text-slate-800"
                        />
                        <button 
                          onClick={() => handleAddRule(stat.name)}
                          className="bg-slate-800 text-black px-2 py-1 rounded text-[10px] font-bold"
                        >
                          ADD
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>

        {/* Time of Day Intelligence */}
        {timeStatsArray.length > 0 && (
          <div className="premium-card premium-glow p-6 mt-8 relative z-10">
            <h3 className="font-orbitron font-bold text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-2 h-2 bg-slate-800 rounded-full animate-pulse shadow-[0_0_10px_#fff]" />
              TIMING INTELLIGENCE & PROFITABILITY WINDOWS
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeStatsArray}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" stroke="#444" tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis stroke="#444" tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    />
                    <Bar dataKey="wins" name="Wins" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="losses" name="Losses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex flex-col space-y-6">
                <div className="bg-slate-800/5 border text-slate-800/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group hover:text-slate-800/30 transition-all">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-800/5 rounded-full blur-3xl group-hover:bg-slate-800/10 transition-all" />
                  <h4 className="text-[10px] font-orbitron font-bold text-gray-500 mb-4 tracking-[0.3em] uppercase">AI EXECUTION DIRECTIVE</h4>
                  
                  {bestHour && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-slate-800 rounded-full" />
                        <span className="text-[10px] text-slate-800 font-bold uppercase tracking-widest">Optimal Strike Zone</span>
                      </div>
                      <div className="text-3xl font-orbitron font-black text-slate-800">{bestHour.hour}</div>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        Your win rate peaks at <span className="text-[#FBBF24] font-bold">{bestHour.total > 0 ? ((bestHour.wins/bestHour.total)*100).toFixed(0) : 0}%</span> during this window. High-conviction setups have maximum follow-through here.
                      </p>
                    </div>
                  )}

                  {worstHour && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-gray-600 rounded-full" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Danger Zone (Avoid)</span>
                      </div>
                      <div className="text-3xl font-orbitron font-black text-gray-600">{worstHour.hour}</div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Statistical drawdown is highest at this time (<span className="font-bold">{worstHour.total > 0 ? ((worstHour.losses/worstHour.total)*100).toFixed(0) : 0}% loss rate</span>). Tighten risk or stay flat.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t text-slate-800/5">
                    <div className="text-[9px] font-bold text-slate-800 uppercase tracking-[0.2em] mb-2 opacity-50">Strategic Summary</div>
                    <p className="text-[10px] text-gray-400 italic leading-relaxed">
                      "Data analysis confirms a major performance edge between {bestHour?.hour} and {parseInt(bestHour?.hour || '0')+1}:00. Conversely, liquidity or psychological fatigue appears to impact your {worstHour?.hour} session. Focus your size on the {bestDayStrategy?.day} {bestDayStrategy?.strategy} setups for maximum alpha, and exercise extreme caution with {worstDayStrategy?.strategy} on {worstDayStrategy?.day}s."
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/5 border text-slate-800/10 rounded-xl p-4">
                    <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">Highest R:R Day</span>
                    <span className="text-xs font-bold text-slate-800">{bestDayStrategy?.day || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-800/5 border text-slate-800/10 rounded-xl p-4">
                    <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">Volume Peak</span>
                    <span className="text-xs font-bold text-slate-800">{timeStatsArray.sort((a,b) => b.total - a.total)[0]?.hour || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly P&L */}
        <div className="premium-card premium-glow p-6 mt-8 relative z-10">
          <h3 className="font-orbitron font-bold text-slate-800 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse" />
            MONTHLY P&L
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPnLData}>
                <XAxis dataKey="month" stroke="#555" />
                <YAxis stroke="#555" />
                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#FFFFFF', boxShadow: '0 0 10px rgba(255,255,255,0.2)' }} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {monthlyPnLData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Performance Review */}
        <div className="premium-card premium-glow p-6 mt-8 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h3 className="font-orbitron font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 bg-slate-800 animate-pulse rounded-full" />
              MONTHLY PERFORMANCE REVIEW
            </h3>
            <button 
              onClick={() => trades && exportWeeklyMistakesPDF(trades)}
              className="mt-4 md:mt-0 flex items-center gap-2 bg-slate-800/10 hover:bg-slate-800/20 text-slate-800 border text-slate-800/50 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-[0_0_10px_rgba(255,255,255,0.1)]"
            >
              <Download size={14} />
              <span>Download Weekly Mistakes PDF</span>
            </button>
          </div>
          
          <div className="space-y-8">
            {(monthlyReportArray as MonthlyReport[]).map((report: MonthlyReport) => {
              const strategyStatsReport = Object.values(report.strategies).map((s: any) => ({
                ...s,
                winRate: s.totalTrades > 0 ? (s.wins / s.totalTrades * 100).toFixed(0) : '0',
                efficiency: s.market > 0 ? (s.captured / s.market * 100).toFixed(0) : '0',
                avgRR: s.rrCount > 0 ? (s.rrTotal / s.rrCount).toFixed(2) : '0.00'
              }));

              const topByWinRate = [...strategyStatsReport].sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))[0];
              const topByRR = [...strategyStatsReport].sort((a, b) => parseFloat(b.avgRR) - parseFloat(a.avgRR))[0];
              const mostLosses = [...strategyStatsReport].sort((a, b) => b.losses - a.losses)[0];

              const uniqueMistakes = Array.from(new Set(report.mistakes)) as string[];

              return (
                <div key={report.month} className="border-l-2 text-slate-800/30 pl-6 py-2 relative">
                  <div className="absolute left-[-5px] top-4 w-2 h-2 bg-slate-800 rounded-full shadow-[0_0_10px_#FFFFFF]" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h4 className="text-2xl font-orbitron font-bold text-slate-800">{report.month.toUpperCase()}</h4>
                      <button 
                        onClick={() => trades && exportMonthlyReportPDF(trades, report.month)}
                        className="flex items-center gap-1 bg-slate-800/10 hover:bg-slate-800/20 text-slate-800 border text-slate-800/50 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all"
                      >
                        <Download size={12} />
                        <span>Export PDF</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-2 md:mt-0">
                      <div className="text-center px-4 py-1 bg-black/40 rounded border text-slate-800/5">
                        <div className="text-[8px] text-gray-500 uppercase">Total P&L</div>
                        <div className={`text-sm font-bold ${report.totalPnl >= 0 ? 'text-neonGreen' : 'text-neonRed'}`}>
                          {report.totalPnl >= 0 ? `+$${report.totalPnl.toFixed(2)}` : `-$${Math.abs(report.totalPnl).toFixed(2)}`}
                        </div>
                      </div>
                      <div className="text-center px-4 py-1 bg-black/40 rounded border text-slate-800/5">
                        <div className="text-[8px] text-gray-500 uppercase">Win Rate</div>
                        <div className="text-sm font-bold text-[#FBBF24]">{report.trades > 0 ? (report.wins / report.trades * 100).toFixed(1) : '0'}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Mistakes Column */}
                    <div className="bg-black/30 rounded-lg p-4 border text-slate-800/10 border-sec-psychology">
                      <h5 className="text-[10px] font-bold mb-3 uppercase tracking-widest text-sec-psychology">⚠️ Psychology & Mistakes</h5>
                      {uniqueMistakes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {uniqueMistakes.map((m: string) => (
                            <span key={m} className="px-2 py-1 bg-slate-800/10 border text-slate-800/20 text-slate-800 text-[9px] rounded font-bold uppercase">{m}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs italic">Flawless execution detected.</p>
                      )}
                    </div>

                    {/* Strategy Efficiency Column */}
                    <div className="bg-black/30 rounded-lg p-4 border text-slate-800/10 border-sec-harvest">
                      <h5 className="text-[10px] font-bold mb-3 uppercase tracking-widest text-sec-harvest">🌾 Strategy Harvest (Capture)</h5>
                      <div className="space-y-3">
                        {strategyStatsReport.slice(0, 3).map((s: any) => {
                          return (
                          <div key={s.name}>
                            <div className="flex justify-between text-[9px] font-bold mb-1">
                              <span className={getStrategyTextClass(s.name)}>{s.name.toUpperCase()}</span>
                              <span className="text-slate-800">{s.efficiency}%</span>
                            </div>
                            <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${s.efficiency}%` }}
                                className={`h-full transition-all ${getStrategyBgClass(s.name)}`}
                              />
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Best/Worst Column */}
                    <div className="bg-black/30 rounded-lg p-4 border text-slate-800/10 border-sec-insights">
                      <h5 className="text-[10px] font-bold mb-3 uppercase tracking-widest text-sec-insights">🔍 Intelligence Insights</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-500 uppercase">Top Win Rate</span>
                          <span className="text-[#FBBF24] font-bold">{topByWinRate?.name || 'N/A'} ({topByWinRate?.winRate}%)</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-500 uppercase">Highest R:R</span>
                          <span className="text-slate-800 font-bold">{topByRR?.name || 'N/A'} (1:{topByRR?.avgRR})</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-500 uppercase">Most Losses</span>
                          <span className="text-slate-800 font-bold">{mostLosses?.name || 'N/A'} ({mostLosses?.losses} trades)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade Table */}
        <TradeTable strategyFilter={selectedStrategies} />

      </main>

      {/* Trade Entry Modal */}
      <TradeEntry isOpen={isEntryOpen} onClose={() => setIsEntryOpen(false)} />
    </div>
  );
}
