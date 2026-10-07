import React from 'react';
import { 
  LayoutDashboard, 
  ListFilter, 
  Coins, 
  Clock, 
  Copy, 
  Map, 
  FileText, 
  Sliders, 
  ChevronLeft, 
  ChevronRight,
  X,
  ClipboardCheck
} from 'lucide-react';
import Logo from './Logo';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isCollapsed, 
  setIsCollapsed, 
  isMobileOpen,
  setIsMobileOpen,
  onOpenSettings 
}) {
  const navItems = [
    { id: 'COMMAND_CENTER', label: 'Overview', icon: LayoutDashboard },
    { id: 'FIELD_VERIFICATION', label: 'Field Verification', icon: ClipboardCheck },
    { id: 'WORK_LIST', label: 'Risk Works', icon: ListFilter },
    { id: 'COST_ANOMALIES', label: 'Cost Anomalies', icon: Coins },
    { id: 'DELAY_STAGNATION', label: 'Delay & Stagnation', icon: Clock },
    { id: 'DUPLICATES', label: 'Possible Duplicates', icon: Copy },
    { id: 'MAP', label: 'Risk Map', icon: Map },
    { id: 'REPORTS', label: 'Reports', icon: FileText },
  ];

  const handleNavClick = (tabId) => {
    setCurrentTab(tabId);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  const navContent = (collapsed) => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#E8E4DC] overflow-hidden shrink-0">
        <Logo collapsed={collapsed} size="md" />
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#F7F7F1] transition-colors"
          aria-label="Close navigation sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        <div className="px-3 py-1.5 text-[10px] font-semibold text-[#8E8D8A] uppercase tracking-wider">
          {!collapsed ? 'Intelligence & Audit' : '•••'}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[#4B3C32] ${
                isActive
                  ? 'bg-[#4B3C32] text-white font-medium shadow-xs shadow-[#4B3C32]/10'
                  : 'text-[#5E5E5D] hover:bg-[#F7F7F1] hover:text-[#050505]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-[#8E8D8A]'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Tools & Collapse Button */}
      <div className="p-3 border-t border-[#E8E4DC] space-y-1.5 shrink-0 bg-[#FAF9F6]">
        <button
          onClick={() => {
            onOpenSettings();
            if (setIsMobileOpen) setIsMobileOpen(false);
          }}
          title={collapsed ? 'Policy Settings & Weights' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#5E5E5D] hover:bg-white hover:text-[#050505] hover:shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-[#4B3C32]"
        >
          <Sliders className="w-4 h-4 text-[#8E8D8A] shrink-0" />
          {!collapsed && <span className="truncate">Policy Weights</span>}
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs text-[#8E8D8A] hover:bg-white hover:text-[#050505] hover:shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-[#4B3C32]"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px] font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-[#E4E7EC] transition-all duration-200 shrink-0 z-20 ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {navContent(isCollapsed)}
      </aside>

      {/* 2. Mobile / Tablet Drawer with Backdrop Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div className="relative w-64 max-w-[80vw] h-full bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
            {navContent(false)}
          </div>
        </div>
      )}
    </>
  );
}
