import React, { useState } from 'react';
import { Bell, User, HelpCircle, Menu, ChevronDown } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import HelpModal from './HelpModal';
import UserProfileModal from './UserProfileModal';
import SyncStatusIndicator from './SyncStatusIndicator';
import { useToast } from './Toast';

export default function Header({ 
  currentRole, 
  setCurrentRole, 
  criticalCount = 0,
  works = [],
  onSelectWork,
  onToggleMobileSidebar,
  onRefreshData
}) {
  const { addToast } = useToast();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const roles = [
    { id: 'DISTRICT', label: 'District Magistrate (Jaipur)', shortLabel: 'DM Jaipur' },
    { id: 'STATE', label: 'State Nodal Officer (Rajasthan)', shortLabel: 'State Nodal' },
    { id: 'MP', label: "Hon'ble MP (Jaipur)", shortLabel: 'MP Jaipur' },
    { id: 'MINISTRY', label: 'Ministry of Statistics (MoSPI)', shortLabel: 'MoSPI Central' },
    { id: 'CITIZEN', label: 'Citizen Transparency View', shortLabel: 'Citizen Portal' },
  ];

  return (
    <>
      <header className="h-16 bg-white border-b border-[#E8E4DC] px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 select-none">
        
        {/* Left: Mobile Menu Trigger & Product Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          
          {/* Hamburger Menu (visible on mobile/tablet < lg) */}
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 -ml-1 rounded-xl text-[#5E5E5D] hover:text-[#050505] hover:bg-[#F7F7F1] transition-colors focus-visible:ring-2 focus-visible:ring-[#4B3C32]"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-[#050505] tracking-tight truncate">
                NIRIKSHAN
              </span>
              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-[#C8BFB3]" />
              <span className="hidden sm:inline text-xs text-[#5E5E5D] font-medium truncate">
                MPLADS AI Monitoring & Risk Intelligence
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Role */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Offline Sync Manager Status Indicator */}
          <SyncStatusIndicator onSelectWork={onSelectWork} />

          {/* Administrative Role Switcher */}
          <div className="flex items-center gap-2" title="Administrative Role Access (Authenticated via Single Sign-On)">
            <label htmlFor="role-select" className="text-xs text-[#5E5E5D] hidden md:inline font-medium">
              Role:
            </label>
            <div className="relative">
              <select
                id="role-select"
                value={currentRole}
                title="Administrative Role Access (Authenticated via Single Sign-On)"
                onChange={(e) => {
                  const newRole = e.target.value;
                  setCurrentRole(newRole);
                  const selectedRoleObj = roles.find(r => r.id === newRole);
                  if (selectedRoleObj) {
                    addToast(`Switched active view to: ${selectedRoleObj.label}`, 'info');
                  }
                }}
                className="bg-[#F7F7F1] hover:bg-[#F2F0EB] text-[#050505] text-xs font-semibold border border-[#D8D2C7] rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:border-[#4B3C32] cursor-pointer appearance-none transition-colors"
                aria-label="Select administrative role"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#5E5E5D] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Notifications Button */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-2 rounded-xl text-[#5E5E5D] hover:text-[#050505] hover:bg-[#F7F7F1] transition-colors focus-visible:ring-2 focus-visible:ring-[#4B3C32]"
            title={`${criticalCount} Critical works requiring verification`}
            aria-label={`${criticalCount} Critical alerts pending review`}
          >
            <Bell className="w-4 h-4" />
            {criticalCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C94C4C] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C94C4C]"></span>
              </span>
            )}
          </button>

          {/* Help / Guide Button */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-xl text-[#5E5E5D] hover:text-[#050505] hover:bg-[#F7F7F1] transition-colors focus-visible:ring-2 focus-visible:ring-[#4B3C32]"
            title="Scheme documentation & verification guidelines"
            aria-label="Open verification guidelines and help documentation"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* User Badge (Clickable to open profile modal) */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-[#E8E4DC] hover:bg-[#F7F7F1] transition-all focus-visible:ring-2 focus-visible:ring-[#4B3C32] rounded-xl p-1.5"
            title="Click to view nodal authority profile & session settings"
            aria-label="Open user and nodal authority profile"
          >
            <div className="w-7 h-7 rounded-full bg-[#4B3C32] text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-xs">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-[#050505] leading-tight">
                {currentRole === 'DISTRICT' && 'DM Office, Jaipur'}
                {currentRole === 'STATE' && 'Govt. of Rajasthan'}
                {currentRole === 'MP' && "Hon'ble MP (Jaipur)"}
                {currentRole === 'MINISTRY' && 'MoSPI Central Ministry'}
                {currentRole === 'CITIZEN' && 'Citizen Transparency'}
              </div>
              <div className="text-[10px] text-[#5E5E5D]">
                {currentRole === 'DISTRICT' && 'District Magistrate'}
                {currentRole === 'STATE' && 'State Nodal Officer'}
                {currentRole === 'MP' && 'Constituency Rep'}
                {currentRole === 'MINISTRY' && 'National Oversight'}
                {currentRole === 'CITIZEN' && 'Public Portal'}
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* Notifications Drawer */}
      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        works={works}
        onSelectWork={onSelectWork}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        onRefreshData={onRefreshData}
      />
    </>
  );
}
