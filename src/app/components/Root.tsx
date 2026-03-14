import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Satellite, Wind, Waves, Leaf, Globe, Activity, Droplets, Volume2, AlertTriangle, Settings, Bell, User, Database, Map, TrendingUp, Clock, LogOut, Search, X, Factory, Flag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import "../../styles/prithvi-theme.css";
import { riskApi, alertsApi, type RiskScore, type Alert } from "../../api/client";
import { useAuth } from "../context/AuthContext";

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Settings state
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [darkMode, setDarkMode] = useState(true);
  const [showAnimations, setShowAnimations] = useState(true);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { path: "/dashboard", label: "India Monitor", icon: Globe, keywords: ["monitor", "home", "dashboard", "india", "overview"], roles: undefined },
    { path: "/dashboard/pollution-map", label: "Pollution Map", icon: Map, keywords: ["pollution", "map", "stations", "pm25", "aqi"], roles: undefined },
    { path: "/dashboard/forecasting", label: "Forecasting", icon: TrendingUp, keywords: ["forecast", "predict", "future", "trend"], roles: undefined },
    { path: "/dashboard/time-machine", label: "Time Machine", icon: Clock, keywords: ["time", "history", "past", "timeline"], roles: undefined },
    { path: "/dashboard/atmosphere", label: "Atmosphere", icon: Wind, keywords: ["atmosphere", "air", "co2", "no2", "pm10"], roles: undefined },
    { path: "/dashboard/ocean", label: "Ocean Systems", icon: Waves, keywords: ["ocean", "water", "marine", "sea"], roles: undefined },
    { path: "/dashboard/biodiversity", label: "Biodiversity", icon: Leaf, keywords: ["biodiversity", "species", "ecosystem", "habitat"], roles: undefined },
    { path: "/dashboard/industries", label: "Industries", icon: Factory, keywords: ["industry", "compliance", "factory", "pollution", "cpcb", "emissions"], roles: undefined },
    { path: "/dashboard/data-archive", label: "Data Archive", icon: Database, keywords: ["data", "archive", "export", "dataset"], roles: undefined },
    { path: "/dashboard/citizen", label: "Report Issue", icon: Flag, keywords: ["report", "complaint", "citizen", "violation", "tree", "dumping"], roles: ["citizen"] },
  ];

  // Filter nav items for search
  const searchResults = searchQuery.trim()
    ? navItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keywords.some(k => k.includes(searchQuery.toLowerCase()))
      )
    : [];

  // Fetch recent alerts for notification bell
  useEffect(() => {
    alertsApi.list(undefined, undefined, 5).then(setRecentAlerts).catch(() => {});
    const interval = setInterval(() => {
      alertsApi.list(undefined, undefined, 5).then(setRecentAlerts).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time environmental data from backend
  const [envData, setEnvData] = useState({
    aqi: 0,
    wqi: 0,
    noise: 0,
    risk: 0
  });

  useEffect(() => {
    const fetchRisk = () => {
      riskApi.list().then((scores: RiskScore[]) => {
        if (scores.length === 0) return;
        // Average across all stations
        const avg = scores.reduce(
          (acc, s) => ({
            aqi: acc.aqi + s.air_quality_index,
            wqi: acc.wqi + s.water_quality_index,
            noise: acc.noise + s.noise_index,
            risk: acc.risk + s.overall_risk,
          }),
          { aqi: 0, wqi: 0, noise: 0, risk: 0 },
        );
        const n = scores.length;
        setEnvData({
          aqi: Math.round(avg.aqi / n),
          wqi: Math.round(avg.wqi / n),
          noise: Math.round(avg.noise / n),
          risk: +(avg.risk / n).toFixed(1),
        });
      }).catch(() => {});
    };
    fetchRisk();
    const interval = setInterval(fetchRisk, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden prithvi-atmosphere-bg">
      {/* Multi-layered atmospheric background overlay */}
      <div className="absolute inset-0 prithvi-gradient-earth pointer-events-none" />
      <div className="absolute inset-0 prithvi-grid-overlay opacity-20 pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-50 border-b backdrop-blur-sm prithvi-inner-glow" style={{
        borderColor: 'var(--prithvi-border-dim)',
        background: 'var(--prithvi-panel-bg-solid)'
      }}>
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and title */}
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center prithvi-glow-electric" 
                     style={{ borderColor: 'var(--prithvi-electric-cyan)' }}>
                  <Satellite className="w-6 h-6" style={{ color: 'var(--prithvi-electric-cyan)' }} />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-dashed opacity-30 prithvi-orbit"
                     style={{ borderColor: 'var(--prithvi-electric-cyan)' }} />
              </motion.div>
              
              <div>
                <h1 className="text-2xl font-bold tracking-wider prithvi-text-electric">
                  PRITHVINET
                </h1>
                <p className="text-xs tracking-widest opacity-70" style={{ color: 'var(--prithvi-atmospheric-teal)' }}>
                  ENVIRONMENTAL INTELLIGENCE PLATFORM
                </p>
              </div>
            </div>

            {/* Search bar and controls */}
            <div className="flex items-center gap-4">
              {/* Search bar */}
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
                     style={{
                       background: 'var(--prithvi-glass)',
                       borderColor: searchOpen ? 'var(--prithvi-electric-cyan)' : 'var(--prithvi-border-dim)',
                       minWidth: searchOpen ? '280px' : '180px',
                     }}>
                  <Search className="w-4 h-4 prithvi-text-electric opacity-60" />
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    className="bg-transparent border-none outline-none text-sm font-mono flex-1 prithvi-text-electric placeholder:opacity-40"
                    style={{ minWidth: 0 }}
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}>
                      <X className="w-3 h-3 prithvi-text-electric opacity-60 hover:opacity-100" />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {searchOpen && searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full mt-2 left-0 right-0 rounded-lg border overflow-hidden z-50"
                      style={{
                        background: 'var(--prithvi-panel-bg-solid)',
                        borderColor: 'var(--prithvi-border-bright)',
                      }}
                    >
                      {searchResults.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setSearchQuery(""); setSearchOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-all"
                          >
                            <Icon className="w-4 h-4 prithvi-text-electric" />
                            <span className="text-sm font-mono prithvi-text-electric">{item.label}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 prithvi-pulse" style={{ color: 'var(--prithvi-aurora-green)' }} />
                <span className="text-sm font-mono prithvi-text-aurora">
                  ALL SYSTEMS OPERATIONAL
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Notifications bell */}
                <div ref={notifRef} className="relative">
                  <button
                    onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); setShowSettings(false); }}
                    className="p-2 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-white/10 relative"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4 prithvi-text-electric" />
                    {recentAlerts.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                            style={{ background: 'var(--prithvi-critical-red)', color: '#fff' }}>
                        {recentAlerts.length}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full mt-2 right-0 w-80 rounded-lg border overflow-hidden z-50"
                        style={{
                          background: 'var(--prithvi-panel-bg-solid)',
                          borderColor: 'var(--prithvi-border-bright)',
                        }}
                      >
                        <div className="p-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                          <span className="text-xs font-mono tracking-wider prithvi-text-electric">RECENT ALERTS</span>
                        </div>
                        {recentAlerts.length === 0 ? (
                          <div className="p-4 text-xs font-mono text-center opacity-50 prithvi-text-electric">No recent alerts</div>
                        ) : (
                          recentAlerts.map((alert) => (
                            <button
                              key={alert.id}
                              onClick={() => { navigate('/dashboard/pollution-map'); setShowNotifications(false); }}
                              className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-white/5 transition-all border-b"
                              style={{ borderColor: 'var(--prithvi-border-dim)' }}
                            >
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{
                                color: alert.severity === 'critical' ? 'var(--prithvi-critical-red)' : 'var(--prithvi-warm-amber)'
                              }} />
                              <div>
                                <div className="text-xs font-mono prithvi-text-electric">
                                  {alert.severity.toUpperCase()}: {alert.pollutant.toUpperCase()}
                                </div>
                                <div className="text-[10px] mt-0.5 opacity-50 prithvi-text-forest">
                                  Station #{alert.station_id} • {alert.value.toFixed(1)} • {new Date(alert.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                        <button
                          onClick={() => { navigate('/dashboard/pollution-map'); setShowNotifications(false); }}
                          className="w-full p-2 text-xs font-mono text-center prithvi-text-ocean hover:bg-white/5 transition-all"
                        >
                          View all stations
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Settings */}
                <div ref={settingsRef} className="relative">
                  <button
                    onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); setShowUserMenu(false); }}
                    className="p-2 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4 prithvi-text-electric" />
                  </button>
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full mt-2 right-0 w-72 rounded-lg border overflow-hidden z-50"
                        style={{
                          background: 'var(--prithvi-panel-bg-solid)',
                          borderColor: 'var(--prithvi-border-bright)',
                        }}
                      >
                        <div className="p-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                          <span className="text-xs font-mono tracking-wider prithvi-text-electric">SETTINGS</span>
                        </div>

                        {/* Dark Mode */}
                        <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                          <span className="text-xs font-mono prithvi-text-electric">Dark Mode</span>
                          <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="relative w-10 h-5 rounded-full transition-all"
                            style={{ background: darkMode ? 'var(--prithvi-aurora-green)' : 'var(--prithvi-grid)' }}
                          >
                            <motion.div
                              animate={{ x: darkMode ? 20 : 2 }}
                              className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                            />
                          </button>
                        </div>

                        {/* Animations */}
                        <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                          <span className="text-xs font-mono prithvi-text-electric">Animations</span>
                          <button
                            onClick={() => setShowAnimations(!showAnimations)}
                            className="relative w-10 h-5 rounded-full transition-all"
                            style={{ background: showAnimations ? 'var(--prithvi-aurora-green)' : 'var(--prithvi-grid)' }}
                          >
                            <motion.div
                              animate={{ x: showAnimations ? 20 : 2 }}
                              className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                            />
                          </button>
                        </div>

                        {/* Refresh Interval */}
                        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono prithvi-text-electric">Refresh Interval</span>
                            <span className="text-xs font-mono prithvi-text-aurora">{refreshInterval}s</span>
                          </div>
                          <div className="flex gap-2">
                            {[10, 30, 60].map(val => (
                              <button
                                key={val}
                                onClick={() => setRefreshInterval(val)}
                                className="flex-1 px-2 py-1 rounded text-[10px] font-mono border transition-all"
                                style={{
                                  background: refreshInterval === val ? 'var(--prithvi-glass-bright)' : 'var(--prithvi-glass)',
                                  borderColor: refreshInterval === val ? 'var(--prithvi-electric-cyan)' : 'var(--prithvi-border-dim)',
                                  color: refreshInterval === val ? 'var(--prithvi-electric-cyan)' : 'inherit',
                                }}
                              >
                                {val}s
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <button
                          onClick={() => { navigate('/dashboard/data-archive'); setShowSettings(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-all text-xs font-mono prithvi-text-electric border-b"
                          style={{ borderColor: 'var(--prithvi-border-dim)' }}
                        >
                          <Database className="w-3 h-3" /> Data Archive
                        </button>
                        <button
                          onClick={() => { navigate('/dashboard/pollution-map'); setShowSettings(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-all text-xs font-mono prithvi-text-electric"
                        >
                          <Map className="w-3 h-3" /> Pollution Map
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* User menu */}
                <div ref={userRef} className="relative">
                  <button
                    onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); setShowSettings(false); }}
                    className="p-2 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                    title="User profile"
                  >
                    <User className="w-4 h-4 prithvi-text-electric" />
                  </button>
                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full mt-2 right-0 w-56 rounded-lg border overflow-hidden z-50"
                        style={{
                          background: 'var(--prithvi-panel-bg-solid)',
                          borderColor: 'var(--prithvi-border-bright)',
                        }}
                      >
                        <div className="p-3 border-b" style={{ borderColor: 'var(--prithvi-border-dim)' }}>
                          <div className="text-xs font-mono prithvi-text-electric">{user?.email ?? 'User'}</div>
                          <div className="text-[10px] mt-0.5 opacity-50 prithvi-text-forest">{user?.role ?? 'admin'}</div>
                        </div>
                        <button
                          onClick={() => { navigate('/dashboard/data-archive'); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all text-xs font-mono prithvi-text-electric"
                        >
                          <Database className="w-3 h-3" /> Data Archive
                        </button>
                        <button
                          onClick={() => { logout(); navigate('/login'); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all text-xs font-mono"
                          style={{ color: 'var(--prithvi-critical-red)' }}
                        >
                          <LogOut className="w-3 h-3" /> Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="p-2 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 prithvi-text-electric" />
                </button>
              </div>

              <div className="text-right">
                <div className="text-xs opacity-70 prithvi-text-electric">
                  {new Date().toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: '2-digit', 
                    year: 'numeric' 
                  })}
                </div>
                <div className="text-sm font-mono" style={{ color: 'var(--prithvi-teal-bright)' }}>
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false 
                  })} UTC
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Environmental Status Bar - Enhanced with larger indicators */}
      <div className="relative z-20 border-b backdrop-blur-sm prithvi-inner-glow"
           style={{
             borderColor: 'var(--prithvi-border-dim)',
             background: 'var(--prithvi-panel-bg)'
           }}>
        <div className="px-6 py-6">
          <div className="grid grid-cols-4 gap-6">
            {/* Air Quality Index */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-5 p-5 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
              style={{
                background: 'var(--prithvi-glass)',
                borderColor: 'var(--prithvi-border-dim)',
              }}
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center prithvi-glow-aurora"
                     style={{ borderColor: 'var(--prithvi-aurora-green)' }}>
                  <Wind className="w-8 h-8 prithvi-text-aurora" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-aurora-green)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute -inset-1 rounded-full border border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-aurora-green)', opacity: 0.3 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono tracking-wider opacity-70 prithvi-text-electric">
                  AIR RISK INDEX
                </div>
                <motion.div
                  key={Math.floor(envData.aqi)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold font-mono prithvi-text-aurora"
                >
                  {Math.floor(envData.aqi)}<span className="text-sm opacity-60">/100</span>
                </motion.div>
                <div className="text-xs font-mono opacity-60 prithvi-text-forest">
                  {envData.aqi < 25 ? 'Low Risk' : envData.aqi < 50 ? 'Moderate' : 'High Risk'} • Normalized
                </div>
              </div>
            </motion.div>

            {/* Water Quality Index */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-5 p-5 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
              style={{
                background: 'var(--prithvi-glass)',
                borderColor: 'var(--prithvi-border-dim)',
              }}
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center prithvi-glow-electric"
                     style={{ borderColor: 'var(--prithvi-ocean-bright)' }}>
                  <Droplets className="w-8 h-8 prithvi-text-ocean" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-ocean-bright)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute -inset-1 rounded-full border border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-ocean-bright)', opacity: 0.3 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono tracking-wider opacity-70 prithvi-text-electric">
                  WATER RISK INDEX
                </div>
                <motion.div
                  key={Math.floor(envData.wqi)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold font-mono prithvi-text-ocean"
                >
                  {Math.floor(envData.wqi)}<span className="text-sm opacity-60">/100</span>
                </motion.div>
                <div className="text-xs font-mono opacity-60 prithvi-text-forest">
                  {envData.wqi < 25 ? 'Low Risk' : envData.wqi < 50 ? 'Moderate' : 'High Risk'} • Normalized
                </div>
              </div>
            </motion.div>

            {/* Noise Pollution Levels */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-5 p-5 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow"
              style={{
                background: 'var(--prithvi-glass)',
                borderColor: 'var(--prithvi-border-dim)',
              }}
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center prithvi-glow-amber"
                     style={{ borderColor: 'var(--prithvi-warm-amber)' }}>
                  <Volume2 className="w-8 h-8" style={{ color: 'var(--prithvi-warm-amber)' }} />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-warm-amber)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute -inset-1 rounded-full border border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-warm-amber)', opacity: 0.3 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono tracking-wider opacity-70 prithvi-text-electric">
                  NOISE RISK INDEX
                </div>
                <motion.div
                  key={Math.floor(envData.noise)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold font-mono"
                  style={{ color: 'var(--prithvi-warm-amber)' }}
                >
                  {Math.floor(envData.noise)}<span className="text-sm opacity-60">/100</span>
                </motion.div>
                <div className="text-xs font-mono opacity-60 prithvi-text-forest">
                  {envData.noise < 25 ? 'Low Risk' : envData.noise < 50 ? 'Moderate' : 'Elevated'} • Normalized
                </div>
              </div>
            </motion.div>

            {/* Environmental Risk Score */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-5 p-5 rounded-lg border backdrop-blur-md prithvi-card-layered prithvi-inner-glow-critical"
              style={{
                background: 'var(--prithvi-glass)',
                borderColor: 'var(--prithvi-border-dim)',
              }}
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center prithvi-glow-critical"
                     style={{ borderColor: 'var(--prithvi-critical-red)' }}>
                  <AlertTriangle className="w-8 h-8" style={{ color: 'var(--prithvi-critical-red)' }} />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-transparent"
                  style={{ borderTopColor: 'var(--prithvi-critical-red)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute -inset-1 rounded-full border border-transparent prithvi-pulse"
                  style={{ borderTopColor: 'var(--prithvi-critical-red)', opacity: 0.5 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono tracking-wider opacity-70 prithvi-text-electric">
                  OVERALL RISK SCORE
                </div>
                <motion.div
                  key={envData.risk.toFixed(1)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold font-mono"
                  style={{ color: 'var(--prithvi-critical-red)' }}
                >
                  {envData.risk.toFixed(1)}<span className="text-sm opacity-60">/100</span>
                </motion.div>
                <div className="text-xs font-mono opacity-60 prithvi-text-forest">
                  {envData.risk < 25 ? 'Low' : envData.risk < 50 ? 'Moderate' : envData.risk < 75 ? 'High' : 'Critical'} • Weighted
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main layout with left sidebar */}
      <div className="flex relative z-10" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* Left Navigation Rail */}
        <aside className="w-20 border-r backdrop-blur-sm prithvi-inner-glow sticky top-0 overflow-y-auto"
               style={{
                 borderColor: 'var(--prithvi-border-dim)',
                 background: 'var(--prithvi-panel-bg)',
                 height: 'calc(100vh - 220px)'
               }}>
          <nav className="flex flex-col gap-1 p-2">
            {navItems.filter(item => {
              if (item.path === '/dashboard/data-archive') return false;
              if (item.roles && !item.roles.includes(user?.role ?? '')) return false;
              return true;
            }).map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    whileHover={{ scale: 1.05, x: 5 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative p-3 rounded-lg transition-all group"
                    style={{
                      background: isActive ? 'var(--prithvi-glass-bright)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--prithvi-electric-cyan)' : '3px solid transparent',
                    }}
                    title={item.label}
                  >
                    <Icon className="w-6 h-6 mx-auto" style={{ 
                      color: isActive ? 'var(--prithvi-electric-cyan)' : 'var(--prithvi-atmospheric-teal)' 
                    }} />
                    
                    {isActive && (
                      <motion.div
                        className="absolute top-0 right-0 bottom-0 w-1 prithvi-glow-electric"
                        style={{ background: 'var(--prithvi-electric-cyan)' }}
                        layoutId="activeSidebar"
                      />
                    )}

                    {/* Tooltip on hover */}
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap prithvi-inner-glow z-50"
                         style={{
                           background: 'var(--prithvi-panel-bg-solid)',
                           border: '1px solid var(--prithvi-border-bright)',
                         }}>
                      <span className="text-xs font-mono prithvi-text-electric">{item.label}</span>
                    </div>
                  </motion.div>
                </Link>
              );
            })}

            <div className="mt-auto pt-6 space-y-2">
              <Link to="/dashboard/data-archive">
                <motion.button
                  whileHover={{ scale: 1.05, x: 5 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full p-3 rounded-lg transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
                  title="Data Archive"
                >
                  <Database className="w-6 h-6 mx-auto prithvi-text-electric opacity-60" />
                </motion.button>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main content area */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}