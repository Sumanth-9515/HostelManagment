import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Building, User, IndianRupee, Trash2, CheckCircle, 
  RefreshCw, LogOut, FileText, CalendarClock, 
  BedDouble, Home, TrendingUp, Bell, Filter, Search, 
  Crown, Zap, Menu, X
} from "lucide-react";

// Time Ago formatter
const timeAgo = (dateString) => {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + " years ago";
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + " months ago";
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + " days ago";
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + " hours ago";
  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + " mins ago";
  return "Just now";
};

// Generate rich, descriptive message based on action type and entity
const getActionMessage = (actionType, entityType, description) => {
  const entity = entityType?.toLowerCase() || "";
  
  switch (actionType) {
    case "ONBOARD":
      if (entity === "tenant") return "✨A New Tenant Onboarded Successfully";
      if (entity === "building") return "🏢 New building added to portfolio";
      return "🎉 New onboarding completed";
    
    case "CREATE":
      if (entity === "tenant") return "📝A New Tenant Added by Owner";
      if (entity === "building") return "🏗️ A New Building Added";
      if (entity === "room") return "🛏️ A New Room Added";
      return "📄 New entry added";
    
    case "PAYMENT":
      return "💰A Tenant Payment Updated";
    
    case "VACATE":
      if (entity === "tenant") return "🚪A Tenant vacated successfully";
      return "🔓 Vacated successfully";
    
    case "UPDATE":
      if (entity === "tenant") return "✏️ Tenant details updated";
      if (entity === "building") return "🔧 Building information updated";
      if (entity === "room") return "🛠️ Room configuration updated";
      return "📝 Record updated";
    
    case "DELETE":
      return "🗑️Record permanently removed";
    
    case "REALLOCATE":
      return "🔄Room reallocation completed";
    
    default:
      return description || "System activity recorded";
  }
};

// Get action display name with emoji
const getActionDisplay = (actionType) => {
  const actions = {
    "CREATE": { name: "Created", emoji: "✨" },
    "ONBOARD": { name: "Onboarded", emoji: "🎉" },
    "UPDATE": { name: "Updated", emoji: "📝" },
    "DELETE": { name: "Deleted", emoji: "🗑️" },
    "PAYMENT": { name: "Payment", emoji: "💰" },
    "VACATE": { name: "Vacated", emoji: "🚪" },
    "REALLOCATE": { name: "Reallocated", emoji: "🔄" },
  };
  return actions[actionType] || { name: actionType?.toLowerCase() || "Activity", emoji: "📌" };
};

// UI Styling mapping
const getIconConfig = (actionType) => {
  const configs = {
    "CREATE": { 
      icon: <CheckCircle size={20} />, 
      bgGradient: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      badgeColor: "bg-emerald-100 text-emerald-700",
      lightBg: "bg-emerald-50/80"
    },
    "ONBOARD": { 
      icon: <User size={20} />, 
      bgGradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      badgeColor: "bg-blue-100 text-blue-700",
      lightBg: "bg-blue-50/80"
    },
    "UPDATE": { 
      icon: <FileText size={20} />, 
      bgGradient: "bg-gradient-to-br from-amber-500 to-amber-600",
      badgeColor: "bg-amber-100 text-amber-700",
      lightBg: "bg-amber-50/80"
    },
    "DELETE": { 
      icon: <Trash2 size={20} />, 
      bgGradient: "bg-gradient-to-br from-rose-500 to-rose-600",
      badgeColor: "bg-rose-100 text-rose-700",
      lightBg: "bg-rose-50/80"
    },
    "PAYMENT": { 
      icon: <IndianRupee size={20} />, 
      bgGradient: "bg-gradient-to-br from-green-500 to-green-600",
      badgeColor: "bg-green-100 text-green-700",
      lightBg: "bg-green-50/80"
    },
    "VACATE": { 
      icon: <LogOut size={20} />, 
      bgGradient: "bg-gradient-to-br from-orange-500 to-orange-600",
      badgeColor: "bg-orange-100 text-orange-700",
      lightBg: "bg-orange-50/80"
    },
    "REALLOCATE": { 
      icon: <RefreshCw size={20} />, 
      bgGradient: "bg-gradient-to-br from-purple-500 to-purple-600",
      badgeColor: "bg-purple-100 text-purple-700",
      lightBg: "bg-purple-50/80"
    },
  };
  return configs[actionType] || { 
    icon: <CalendarClock size={20} />, 
    bgGradient: "bg-gradient-to-br from-gray-500 to-gray-600",
    badgeColor: "bg-gray-100 text-gray-700",
    lightBg: "bg-gray-50/80"
  };
};

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("All");
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const fetchLogs = async (currentPage, currentFilter, reset = false) => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem("token");
      if (!token) {
        console.error("❌ No token found!");
        setLoading(false);
        return;
      }
      const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
        || "http://localhost:5000/api";
      const res = await axios.get(
        `${API_BASE_URL}/activities?page=${currentPage}&limit=20&entityType=${currentFilter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (reset) {
        setLogs(res.data.logs);
      } else {
        setLogs((prev) => [...prev, ...res.data.logs]);
      }
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Failed to fetch logs:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, filter, true);
    setPage(1);
  }, [filter]);

  const loadMore = () => {
    if (page < totalPages) {
      fetchLogs(page + 1, filter, false);
      setPage(page + 1);
    }
  };

  const filteredLogs = logs.filter(log => 
    searchTerm === "" || 
    log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entityType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStats = () => {
    return {
      total: logs.length,
      payments: logs.filter(l => l.actionType === "PAYMENT").length,
      onboardings: logs.filter(l => l.actionType === "ONBOARD").length,
      vacations: logs.filter(l => l.actionType === "VACATE").length,
      updates: logs.filter(l => l.actionType === "UPDATE").length,
      creates: logs.filter(l => l.actionType === "CREATE").length,
    };
  };

  const stats = getStats();

  // Filter buttons data
  const filterButtons = [
    { key: "All", label: "📋 All", emoji: "📋" },
    { key: "Tenant", label: "👥 Tenants", emoji: "👥" },
    { key: "Building", label: "🏘️ Buildings", emoji: "🏘️" },
    { key: "Rent", label: "💰 Payments", emoji: "💰" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      {/* Decorative background */}
      <div className="fixed top-0 right-0 w-72 h-72 md:w-96 md:h-96 bg-indigo-300/20 rounded-full blur-3xl -z-10"></div>
      <div className="fixed bottom-0 left-0 w-72 h-72 md:w-96 md:h-96 bg-emerald-300/20 rounded-full blur-3xl -z-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        
        {/* Hero Section - Responsive */}
        <div className="mb-6 md:mb-10">
          <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
       
            <div>
              <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 via-indigo-700 to-purple-600 bg-clip-text text-transparent">
                Hostel Account Activity Logs
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1 flex items-center gap-1 md:gap-2">
                <BedDouble size={12} className="md:w-4 md:h-4 text-indigo-500" />
                <span>Real-time tracking of tenant movements & payments</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats Dashboard - Horizontal scroll on mobile */}
        {showStats && logs.length > 0 && (
          <div className="mb-6 md:mb-10 overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-3 md:grid md:grid-cols-5 md:gap-5 min-w-max md:min-w-0">
              <div className="w-40 md:w-auto bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg border border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <p className="text-xs md:text-sm text-gray-500 font-medium">Total</p>
                  <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                </div>
                <p className="text-xl md:text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              
              <div className="w-40 md:w-auto bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg border border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <p className="text-xs md:text-sm text-gray-500 font-medium">Payments</p>
                  <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg md:rounded-xl flex items-center justify-center">
                    <IndianRupee className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                </div>
                <p className="text-xl md:text-3xl font-bold text-gray-800">{stats.payments}</p>
              </div>
              
              <div className="w-40 md:w-auto bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg border border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <p className="text-xs md:text-sm text-gray-500 font-medium">New</p>
                  <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg md:rounded-xl flex items-center justify-center">
                    <User className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                </div>
                <p className="text-xl md:text-3xl font-bold text-gray-800">{stats.onboardings}</p>
              </div>
              
              <div className="w-40 md:w-auto bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg border border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <p className="text-xs md:text-sm text-gray-500 font-medium">Vacated</p>
                  <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg md:rounded-xl flex items-center justify-center">
                    <LogOut className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                </div>
                <p className="text-xl md:text-3xl font-bold text-gray-800">{stats.vacations}</p>
              </div>
              
              <div className="w-40 md:w-auto bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg border border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <p className="text-xs md:text-sm text-gray-500 font-medium">Updates</p>
                  <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg md:rounded-xl flex items-center justify-center">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                </div>
                <p className="text-xl md:text-3xl font-bold text-gray-800">{stats.updates + stats.creates}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Bar - Mobile Optimized */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg border border-gray-100 p-3 md:p-5 mb-4 md:mb-8">
          {/* Mobile: Filter toggle + Search row */}
          <div className="flex items-center justify-between gap-2 md:hidden">
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg text-white text-sm font-medium"
            >
              <Filter size={16} />
              <span>Filter</span>
              {filter !== "All" && <span className="bg-white text-indigo-600 rounded-full px-1.5 text-xs">●</span>}
            </button>
            
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
            
            <button 
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-2 text-gray-500 text-xs font-medium bg-gray-100 rounded-lg"
            >
              {showStats ? "📊" : "📈"}
            </button>
          </div>

          {/* Mobile Filter Dropdown */}
          {mobileFilterOpen && (
            <div className="mt-3 pt-3 border-t border-gray-100 md:hidden">
              <div className="flex flex-wrap gap-2">
                {filterButtons.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setFilter(f.key);
                      setMobileFilterOpen(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      filter === f.key 
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md" 
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Desktop Filter Bar */}
          <div className="hidden md:flex md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                <Filter size={16} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Quick Filter</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
                    filter === f.key 
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200 scale-105" 
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
            
            <button 
              onClick={() => setShowStats(!showStats)}
              className="text-xs text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-1"
            >
              {showStats ? "📊 Hide Stats" : "📈 Show Stats"}
            </button>
          </div>
        </div>

        {/* Activity Timeline - Mobile Optimized */}
        <div className="bg-white rounded-xl md:rounded-3xl shadow-lg md:shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-3 md:p-6 lg:p-8">
            {filteredLogs.length === 0 && !loading ? (
              <div className="text-center py-12 md:py-20">
                <div className="inline-flex p-4 md:p-5 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4 md:mb-5">
                  <Bell className="h-10 w-10 md:h-14 md:w-14 text-gray-400" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-700 mb-2">No Activity Yet</h3>
                <p className="text-sm md:text-base text-gray-400 max-w-md mx-auto px-4">
                  When tenants check-in, make payments, or staff update rooms, you'll see the activity here
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline Vertical Line - Hidden on mobile, visible on tablet+ */}
                <div className="hidden md:block absolute left-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-indigo-200 rounded-full"></div>
                
                <div className="space-y-4 md:space-y-6">
                  {filteredLogs.map((log, index) => {
                    const config = getIconConfig(log.actionType);
                    const actionDisplay = getActionDisplay(log.actionType);
                    const friendlyMessage = getActionMessage(log.actionType, log.entityType, log.description);
                    
                    return (
                      <div key={log._id || index} className="relative flex gap-3 md:gap-5 group animate-fadeIn">
                        {/* Timeline Icon - Smaller on mobile */}
                        <div className="relative z-10 flex-shrink-0">
                          <div className={`h-10 w-10 md:h-12 md:w-12 rounded-lg md:rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${config.bgGradient} shadow-md md:shadow-lg text-white`}>
                            {config.icon}
                          </div>
                        </div>
                        
                        {/* Content Card - Full width on mobile */}
                        <div className={`flex-1 rounded-xl md:rounded-2xl p-3 md:p-5 transition-all duration-300 ${config.lightBg} border border-gray-100 shadow-sm hover:shadow-md`}>
                          {/* Header - Row on mobile, flex wrap */}
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2 md:mb-3">
                            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                              <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full ${config.badgeColor}`}>
                                {log.entityType || "SYSTEM"}
                              </span>
                              <span className="text-[10px] md:text-xs text-gray-400">•</span>
                              <span className="text-xs md:text-sm font-bold text-gray-700 flex items-center gap-0.5 md:gap-1">
                                <span className="text-sm md:text-base">{actionDisplay.emoji}</span>
                                <span>{actionDisplay.name}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-500 bg-white/80 px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-sm">
                              <CalendarClock size={10} className="md:w-3 md:h-3" />
                              <span className="font-medium">{timeAgo(log.createdAt)}</span>
                            </div>
                          </div>
                          
                          {/* Friendly Message */}
                          <p className="text-sm md:text-base font-semibold text-gray-800 leading-relaxed mb-1 md:mb-2">
                            {friendlyMessage}
                          </p>
                          
                          {/* Original Description */}
                          <p className="text-xs md:text-sm text-gray-500 leading-relaxed pl-2 md:pl-3 border-l-2 border-gray-200 mt-1 md:mt-2 break-words">
                            {log.description}
                          </p>
                          
                          {/* Footer with timestamp */}
                          <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-gray-100">
                            <p className="text-[10px] md:text-xs text-gray-400 flex items-center gap-1 md:gap-1.5">
                              <CalendarClock size={9} className="md:w-3 md:h-3" />
                              {new Date(log.createdAt).toLocaleString("en-IN", { 
                                dateStyle: "medium", 
                                timeStyle: "short" 
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Load More Button - Full width on mobile */}
            {page < totalPages && (
              <div className="mt-6 md:mt-12 text-center">
                <button 
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full md:w-auto px-4 md:px-8 py-2.5 md:py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] md:hover:scale-105 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} md:size={18} />
                      <span className="text-sm md:text-base">Loading...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} md:size={18} />
                      <span className="text-sm md:text-base">Load More Activities</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 md:mt-8 text-center">
          <p className="text-[10px] md:text-xs text-gray-400 flex items-center justify-center gap-1 md:gap-2 flex-wrap">
            <Home size={10} className="md:w-3 md:h-3 text-indigo-400" />
            <span>Hostel Management System • Secure & Real-time Activity Tracking</span>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ActivityLogs;