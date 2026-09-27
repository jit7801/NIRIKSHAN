import React from 'react';
import { ShieldAlert, MapPin, Layers, Sliders, CheckCircle2, Building2, UserCheck, AlertTriangle } from 'lucide-react';
import Logo from './Logo';

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  currentRole, 
  setCurrentRole, 
  onOpenCalibration 
}) {
  const roles = [
    { id: "DISTRICT", label: "District Magistrate (Jaipur)", icon: Building2 },
    { id: "STATE", label: "State Nodal Officer (Rajasthan)", icon: Layers },
    { id: "MP", label: "Hon'ble MP (Jaipur)", icon: UserCheck },
    { id: "MINISTRY", label: "Central Ministry (MoSPI)", icon: ShieldAlert },
    { id: "CITIZEN", label: "Citizen Transparency View", icon: CheckCircle2 }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E8E4DC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Title */}
          <Logo theme="light" size="lg" />

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {[
              { id: "COMMAND_CENTER", label: "Risk Command Center" },
              { id: "WORK_LIST", label: "Risk Work List" },
              { id: "DUPLICATES", label: "Duplicate Inspector" },
              { id: "MAP", label: "Geospatial Risk Map" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  currentTab === tab.id
                    ? "bg-[#4B3C32] text-white shadow-xs"
                    : "text-[#5E5E5D] hover:text-[#050505] hover:bg-[#F7F7F1]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Action Tools & Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Policy Calibration Button */}
            <button
              onClick={onOpenCalibration}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#4B3C32]/10 hover:bg-[#4B3C32]/15 text-[#4B3C32] border border-[#4B3C32]/20 rounded-xl transition-all"
              title="Interactive Policy Calibration: Adjust weights live"
            >
              <Sliders className="w-3.5 h-3.5 text-[#4B3C32]" />
              <span>Policy Calibration</span>
            </button>

            {/* Role Dropdown */}
            <div className="relative">
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                className="bg-[#F7F7F1]/70 text-[#050505] text-xs font-medium border border-[#E8E4DC] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#4B3C32] cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
