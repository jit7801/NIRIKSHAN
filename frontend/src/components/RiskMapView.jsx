import React, { useState, useMemo, useEffect, useRef } from 'react';
import RiskBadge from './RiskBadge';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import { 
  MapPin, 
  Filter, 
  RotateCcw, 
  Building2, 
  AlertTriangle, 
  Layers, 
  Search, 
  X, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Crosshair, 
  ShieldAlert, 
  CheckCircle2, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  FileText,
  User,
  Activity,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { useToast } from './Toast';
import { fetchWorks } from '../api/client';

// Basemap layer configurations (Free, reliable, no API key required)
const BASEMAP_TILES = {
  osm: {
    name: 'Topographic Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  esri: {
    name: 'Esri World Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, USGS, FAO'
  },
  hot: {
    name: 'Humanitarian OSM',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

// Internal controller to programmatically adjust view center and zoom
function MapViewController({ center, zoom, focusCoords }) {
  const map = useMap();

  useEffect(() => {
    if (focusCoords && focusCoords.length === 2) {
      map.flyTo(focusCoords, 13, { duration: 1.2 });
    } else if (center && zoom) {
      map.flyTo(center, zoom, { duration: 1 });
    }
  }, [center, zoom, focusCoords, map]);

  return null;
}

export default function RiskMapView({ works = [], onSelectWork }) {
  const { addToast } = useToast();
  
  // Existing state preserves 100% identical functional behavior
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeWork, setActiveWork] = useState(null);
  const [mapCenterKey, setMapCenterKey] = useState(0);
  const [geoWorks, setGeoWorks] = useState([]);

  // UI/UX enhancement state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBaseMap, setActiveBaseMap] = useState('osm');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [focusTargetCoords, setFocusTargetCoords] = useState(null);

  // Preserve existing data loading logic
  useEffect(() => {
    const passedGeos = works.filter((w) => w.latitude && w.longitude);
    if (passedGeos.length >= 100) {
      setGeoWorks(passedGeos);
    } else {
      fetchWorks({ has_coords: true, limit: 1000 })
        .then(res => {
          if (res.items && res.items.length > 0) {
            setGeoWorks(res.items);
          } else {
            setGeoWorks(passedGeos);
          }
        })
        .catch(err => {
          console.warn('Map geoWorks fetch fallback:', err);
          setGeoWorks(passedGeos);
        });
    }
  }, [works]);

  const validWorks = useMemo(() => {
    // Coordinate sanity filter to ensure Indian geographic bounds
    return geoWorks.filter(
      w => w.latitude && w.longitude && 
           w.latitude >= 8.0 && w.latitude <= 37.5 && 
           w.longitude >= 68.0 && w.longitude <= 97.5
    );
  }, [geoWorks]);

  const districts = useMemo(() => Array.from(new Set(validWorks.map((w) => w.district))).filter(Boolean).sort(), [validWorks]);
  const categories = useMemo(() => Array.from(new Set(validWorks.map((w) => w.work_category))).filter(Boolean).sort(), [validWorks]);

  // Dynamic summary statistics computed strictly from existing application data
  const summaryStats = useMemo(() => {
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    validWorks.forEach(w => {
      const s = w.overall_risk_score || 0;
      if (s >= 80) criticalCount++;
      else if (s >= 60) highCount++;
      else if (s >= 30) mediumCount++;
      else lowCount++;
    });

    return {
      total: validWorks.length,
      critical: criticalCount,
      high: highCount,
      combinedHigh: criticalCount + highCount,
      medium: mediumCount,
      low: lowCount,
    };
  }, [validWorks]);

  // Existing filtering logic enhanced only with standard search filtering
  const filtered = useMemo(() => {
    return validWorks.filter((w) => {
      // Risk level thresholds
      if (selectedRisk === 'CRITICAL' && w.overall_risk_score < 80) return false;
      if (selectedRisk === 'HIGH' && (w.overall_risk_score < 60 || w.overall_risk_score >= 80)) return false;
      if (selectedRisk === 'MEDIUM' && (w.overall_risk_score < 30 || w.overall_risk_score >= 60)) return false;
      if (selectedRisk === 'LOW' && w.overall_risk_score >= 30) return false;
      
      // District & Category filters
      if (selectedDistrict !== 'ALL' && w.district !== selectedDistrict) return false;
      if (selectedCategory !== 'ALL' && w.work_category !== selectedCategory) return false;
      
      // Client-side visual search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const idMatch = (w.work_id || '').toLowerCase().includes(term);
        const titleMatch = (w.work_title || '').toLowerCase().includes(term);
        const locMatch = (w.village || w.ward || w.district || '').toLowerCase().includes(term);
        const mpMatch = (w.mp_name || w.constituency || '').toLowerCase().includes(term);
        const agencyMatch = (w.implementing_agency || '').toLowerCase().includes(term);
        if (!idMatch && !titleMatch && !locMatch && !mpMatch && !agencyMatch) return false;
      }

      return true;
    });
  }, [validWorks, selectedRisk, selectedDistrict, selectedCategory, searchTerm]);

  // Visible risk breakdown in current filtered view
  const visibleStats = useMemo(() => {
    let crit = 0;
    let high = 0;
    let med = 0;
    let low = 0;
    filtered.forEach(w => {
      const s = w.overall_risk_score || 0;
      if (s >= 80) crit++;
      else if (s >= 60) high++;
      else if (s >= 30) med++;
      else low++;
    });
    return { crit, high, med, low, total: filtered.length };
  }, [filtered]);

  // Top prioritized projects currently in view
  const topFlaggedInView = useMemo(() => {
    return [...filtered]
      .sort((a, b) => (b.overall_risk_score || 0) - (a.overall_risk_score || 0))
      .slice(0, 4);
  }, [filtered]);

  const getMarkerColor = (score) => {
    if (score >= 80) return '#C94C4C'; // Critical
    if (score >= 60) return '#C94C4C'; // High
    if (score >= 30) return '#E6A23C'; // Medium
    return '#2E8B57'; // Low
  };

  const defaultCenter = [24.5, 78.5]; // Central India default overview

  const resetFilters = () => {
    setSelectedRisk('ALL');
    setSelectedDistrict('ALL');
    setSelectedCategory('ALL');
    setSearchTerm('');
    setActiveWork(null);
    setFocusTargetCoords(null);
    setMapCenterKey((k) => k + 1);
    addToast('Map filters reset to default view.', 'info');
  };

  const handleCenterOnWork = (work) => {
    setActiveWork(work);
    setFocusTargetCoords([work.latitude, work.longitude]);
  };

  const activeFiltersCount = (selectedRisk !== 'ALL' ? 1 : 0) + 
                             (selectedDistrict !== 'ALL' ? 1 : 0) + 
                             (selectedCategory !== 'ALL' ? 1 : 0) + 
                             (searchTerm.trim() ? 1 : 0);

  return (
    <div className="space-y-6">
      
      {/* 1. TOP MAP HEADER & ACTIONS */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF3FB] text-[#12355B] border border-[#D0E2F4]">
              <Compass className="w-3 h-3 text-[#168A8A]" />
              NATIONAL RADAR MONITORING
            </span>
            <span className="text-xs text-[#536878]">·</span>
            <span className="text-xs font-medium text-[#536878]">
              {validWorks.length.toLocaleString()} Monitored Works Across India
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#17212B] tracking-tight">
            Risk Map
          </h1>
          <p className="text-xs text-[#536878] mt-1 max-w-2xl leading-relaxed">
            Geospatial view of MPLADS project risk and anomaly distribution with empirical audit indicators and peer cost baselining.
          </p>
        </div>

        {/* Right Header Quick Controls */}
        <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
          {/* Quick Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-[#536878] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ID, title, MP, agency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F7F9FB] hover:bg-white text-[#17212B] text-xs font-medium rounded-xl border border-[#D0E2F4] pl-8.5 pr-8 py-2 focus:outline-none focus:border-[#1F5F8B] focus:ring-1 focus:ring-[#1F5F8B] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#536878] hover:text-[#17212B]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset Filters / Map View */}
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1F5F8B] bg-[#F0F7FB] hover:bg-[#E2F0F9] border border-[#D5E8F3] rounded-xl transition-colors shadow-xs"
            title="Reset filters and map center"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#168A8A]" />
            <span className="hidden sm:inline">Reset View</span>
          </button>
        </div>
      </div>

      {/* 2. MAP OVERVIEW STATS PANEL */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Works */}
        <button
          onClick={() => setSelectedRisk('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedRisk === 'ALL'
              ? 'bg-white border-[#12355B] shadow-md ring-1 ring-[#12355B]'
              : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#536878] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Works</span>
            <MapPin className="w-4 h-4 text-[#1F5F8B]" />
          </div>
          <div className="text-2xl font-bold text-[#17212B]">
            {summaryStats.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#536878] mt-1 font-medium flex items-center gap-1">
            <span>{filtered.length} in current view</span>
          </div>
        </button>

        {/* High / Critical Risk */}
        <button
          onClick={() => setSelectedRisk(selectedRisk === 'HIGH' || selectedRisk === 'CRITICAL' ? 'ALL' : 'HIGH')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedRisk === 'HIGH' || selectedRisk === 'CRITICAL'
              ? 'bg-[#FDF4F4] border-[#C94C4C] shadow-md ring-1 ring-[#C94C4C]'
              : 'bg-white border-[#E2E8F0] hover:border-[#FADCDA] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#C94C4C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C94C4C] animate-pulse" />
              High / Critical
            </span>
            <AlertTriangle className="w-4 h-4 text-[#C94C4C]" />
          </div>
          <div className="text-2xl font-bold text-[#C94C4C]">
            {summaryStats.combinedHigh.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#536878] mt-1 font-medium">
            Score 60–100 · Priority Audit
          </div>
        </button>

        {/* Medium Risk */}
        <button
          onClick={() => setSelectedRisk(selectedRisk === 'MEDIUM' ? 'ALL' : 'MEDIUM')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedRisk === 'MEDIUM'
              ? 'bg-[#FEF8ED] border-[#E6A23C] shadow-md ring-1 ring-[#E6A23C]'
              : 'bg-white border-[#E2E8F0] hover:border-[#F8E5C4] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#E6A23C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E6A23C]" />
              Medium Risk
            </span>
            <Activity className="w-4 h-4 text-[#E6A23C]" />
          </div>
          <div className="text-2xl font-bold text-[#B87D28]">
            {summaryStats.medium.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#536878] mt-1 font-medium">
            Score 30–59 · Watchlist
          </div>
        </button>

        {/* Low Risk */}
        <button
          onClick={() => setSelectedRisk(selectedRisk === 'LOW' ? 'ALL' : 'LOW')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedRisk === 'LOW'
              ? 'bg-[#EEF7F2] border-[#2E8B57] shadow-md ring-1 ring-[#2E8B57]'
              : 'bg-white border-[#E2E8F0] hover:border-[#D1E8DC] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#2E8B57] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2E8B57]" />
              Low Risk
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <div className="text-2xl font-bold text-[#2E8B57]">
            {summaryStats.low.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#536878] mt-1 font-medium">
            Score 0–29 · Normal Flow
          </div>
        </button>
      </div>

      {/* 3. FILTER TOOLBAR EXPERIENCE */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2.5 flex-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17212B] mr-1">
            <Filter className="w-3.5 h-3.5 text-[#1F5F8B]" />
            <span>Filters:</span>
          </div>

          {/* Risk Level Selector */}
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-[#F7F9FB] hover:bg-white text-[#17212B] text-xs font-medium rounded-xl border border-[#D0E2F4] px-3 py-2 focus:outline-none focus:border-[#1F5F8B] cursor-pointer transition-colors"
          >
            <option value="ALL">All Risk Tiers</option>
            <option value="CRITICAL">🔴 Critical (80+)</option>
            <option value="HIGH">🟠 High (60–79)</option>
            <option value="MEDIUM">🟡 Medium (30–59)</option>
            <option value="LOW">🟢 Low (0–29)</option>
          </select>

          {/* District Selector */}
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="bg-[#F7F9FB] hover:bg-white text-[#17212B] text-xs font-medium rounded-xl border border-[#D0E2F4] px-3 py-2 focus:outline-none focus:border-[#1F5F8B] cursor-pointer transition-colors max-w-[200px]"
          >
            <option value="ALL">All Districts ({districts.length})</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Category Selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#F7F9FB] hover:bg-white text-[#17212B] text-xs font-medium rounded-xl border border-[#D0E2F4] px-3 py-2 focus:outline-none focus:border-[#1F5F8B] cursor-pointer transition-colors max-w-[220px]"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Active Filter Clear Tag */}
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#C94C4C] bg-[#FDF4F4] hover:bg-[#FDF2F2] border border-[#FADCDA] transition-colors"
            >
              <span>Clear {activeFiltersCount} filters</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Visibility Count Indicator */}
        <div className="flex items-center gap-2 text-xs text-[#536878] shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#F1F5F9]">
          <span className="font-semibold text-[#17212B]">
            {filtered.length.toLocaleString()}
          </span>
          <span>of {validWorks.length.toLocaleString()} geocoded projects visible</span>
        </div>
      </div>

      {/* 4. MAIN MAP & INTELLIGENCE PROFILE LAYOUT */}
      <div className={`grid grid-cols-1 ${isExpanded ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-5`}>
        
        {/* Main Geospatial Map Surface */}
        <div className={`${isExpanded ? 'lg:col-span-12' : 'lg:col-span-8'} bg-white rounded-2xl overflow-hidden relative border border-[#E2E8F0] shadow-sm transition-all flex flex-col`}>
          
          {/* Map Canvas */}
          <div className="h-[460px] sm:h-[540px] lg:h-[620px] w-full relative z-0">
            <MapContainer
              key={mapCenterKey}
              center={defaultCenter}
              zoom={5}
              scrollWheelZoom={true}
              className="h-full w-full"
              attributionControl={true}
            >
              <TileLayer
                attribution={BASEMAP_TILES[activeBaseMap].attribution}
                url={BASEMAP_TILES[activeBaseMap].url}
              />

              {/* Dynamic View Controller */}
              <MapViewController 
                center={defaultCenter} 
                zoom={5} 
                focusCoords={focusTargetCoords} 
              />

              {/* Project Markers */}
              {filtered.map((work) => {
                const score = work.overall_risk_score || 0;
                const isSelected = activeWork?.work_id === work.work_id;
                const isCritical = score >= 80;
                const isHigh = score >= 60;
                const baseRadius = isCritical ? 9 : isHigh ? 7.5 : score >= 30 ? 6 : 4.5;

                return (
                  <React.Fragment key={work.work_id}>
                    {/* Subtle outer halo for critical projects or selected item */}
                    {(isCritical || isSelected) && (
                      <CircleMarker
                        center={[work.latitude, work.longitude]}
                        radius={isSelected ? baseRadius + 7 : baseRadius + 5}
                        fillColor={isSelected ? '#12355B' : '#C94C4C'}
                        color={isSelected ? '#168A8A' : '#C94C4C'}
                        weight={isSelected ? 2 : 1}
                        opacity={0.6}
                        fillOpacity={isSelected ? 0.25 : 0.18}
                        interactive={false}
                      />
                    )}

                    {/* Primary Interactive Marker */}
                    <CircleMarker
                      center={[work.latitude, work.longitude]}
                      radius={isSelected ? baseRadius + 2 : baseRadius}
                      fillColor={getMarkerColor(score)}
                      color="#FFFFFF"
                      weight={isSelected ? 2.5 : 1.5}
                      opacity={1}
                      fillOpacity={0.92}
                      eventHandlers={{
                        click: () => {
                          setActiveWork(work);
                        },
                      }}
                    >
                      {/* Hover Tooltip */}
                      <Tooltip direction="top" offset={[0, -6]} opacity={0.96} className="gov-map-tooltip">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="font-mono">{work.work_id}</span>
                            <span>· {score}/100</span>
                          </div>
                          <div className="text-[11px] truncate max-w-[200px] text-gray-200">
                            {work.work_title}
                          </div>
                          <div className="text-[10px] text-gray-300">
                            {work.district}, {work.state} · ₹{((work.sanctioned_amount || 0) / 100000).toFixed(1)}L
                          </div>
                        </div>
                      </Tooltip>

                      {/* Interactive Popup Card */}
                      <Popup className="gov-map-popup" maxWidth={310} minWidth={270}>
                        <div className="p-1 space-y-2.5 font-sans">
                          {/* Top Row */}
                          <div className="flex items-center justify-between gap-1.5 border-b border-[#E2E8F0] pb-2">
                            <span className="font-mono text-xs font-bold text-[#12355B] bg-[#EBF3FB] px-2 py-0.5 rounded border border-[#D0E2F4]">
                              {work.work_id}
                            </span>
                            <RiskBadge score={work.overall_risk_score} level={work.risk_level} size="sm" />
                          </div>

                          {/* Work Title & Location */}
                          <div>
                            <h4 className="font-bold text-[#17212B] text-xs leading-snug line-clamp-2">
                              {work.work_title || 'MPLADS Project'}
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] text-[#536878] mt-1">
                              <MapPin className="w-3 h-3 text-[#168A8A] shrink-0" />
                              <span className="truncate">{work.village || work.ward ? `${work.village || work.ward}, ` : ''}{work.district}, {work.state}</span>
                            </div>
                          </div>

                          {/* Financials & Dual Progress */}
                          <div className="bg-[#F7F9FB] p-2 rounded-xl border border-[#E2E8F0] space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-[#536878]">Sanctioned Amount:</span>
                              <span className="font-bold text-[#17212B]">₹{((work.sanctioned_amount || 0) / 100000).toFixed(2)} L</span>
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] text-[#536878] mb-0.5">
                                <span>Phys: <b className="text-[#17212B]">{work.physical_progress || 0}%</b></span>
                                <span>Fin: <b className="text-[#17212B]">{work.financial_progress || 0}%</b></span>
                              </div>
                              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden flex">
                                <div 
                                  className="bg-[#1F5F8B] h-full" 
                                  style={{ width: `${Math.min(work.physical_progress || 0, 100)}%` }} 
                                />
                              </div>
                            </div>
                          </div>

                          {/* Primary Signal */}
                          {work.primary_risk_factor && (
                            <div className="flex items-center gap-1 text-[10px] text-[#C94C4C] bg-[#FDF4F4] px-2 py-1 rounded-lg border border-[#FADCDA] font-medium">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="truncate">{work.primary_risk_factor}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="pt-1 flex gap-2">
                            <button
                              onClick={() => setActiveWork(work)}
                              className="flex-1 py-1.5 text-xs font-semibold text-[#1F5F8B] bg-[#F0F7FB] hover:bg-[#E2F0F9] border border-[#D5E8F3] rounded-lg transition-colors text-center"
                            >
                              Inspect Profile
                            </button>
                            <button
                              onClick={() => onSelectWork(work.work_id)}
                              className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#12355B] hover:bg-[#1A497B] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                            >
                              <span>Full Dossier</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                );
              })}
            </MapContainer>

            {/* 4.A FLOATING MAP CONTROLS (TOP RIGHT) */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              {/* Reset to National Extent */}
              <button
                onClick={() => {
                  setFocusTargetCoords([24.5, 78.5]);
                  setMapCenterKey(k => k + 1);
                }}
                className="w-9 h-9 bg-white/95 hover:bg-white text-[#17212B] rounded-xl border border-[#D0E2F4] shadow-md flex items-center justify-center transition-all"
                title="Center on India"
              >
                <Crosshair className="w-4 h-4 text-[#1F5F8B]" />
              </button>

              {/* Layer Switcher Button */}
              <div className="relative">
                <button
                  onClick={() => setShowLayerMenu(!showLayerMenu)}
                  className={`w-9 h-9 rounded-xl border shadow-md flex items-center justify-center transition-all ${
                    showLayerMenu 
                      ? 'bg-[#12355B] text-white border-[#12355B]' 
                      : 'bg-white/95 hover:bg-white text-[#17212B] border-[#D0E2F4]'
                  }`}
                  title="Switch Map Tiles"
                >
                  <Layers className="w-4 h-4" />
                </button>

                {/* Layer Menu Dropdown */}
                {showLayerMenu && (
                  <div className="absolute right-0 top-11 w-48 bg-white rounded-xl border border-[#D0E2F4] shadow-xl p-2 z-[1001] space-y-1">
                    <span className="text-[10px] font-bold text-[#536878] px-2 py-1 uppercase block tracking-wider">
                      Basemap Layer
                    </span>
                    {Object.entries(BASEMAP_TILES).map(([key, item]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setActiveBaseMap(key);
                          setShowLayerMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center justify-between ${
                          activeBaseMap === key
                            ? 'bg-[#EBF3FB] text-[#12355B] font-bold'
                            : 'text-[#17212B] hover:bg-[#F7F9FB]'
                        }`}
                      >
                        <span>{item.name}</span>
                        {activeBaseMap === key && <CheckCircle2 className="w-3.5 h-3.5 text-[#168A8A]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen / Expand Map Toggle */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-9 h-9 bg-white/95 hover:bg-white text-[#17212B] rounded-xl border border-[#D0E2F4] shadow-md flex items-center justify-center transition-all hidden lg:flex"
                title={isExpanded ? 'Collapse Map' : 'Expand Full Width'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4 text-[#1F5F8B]" /> : <Maximize2 className="w-4 h-4 text-[#1F5F8B]" />}
              </button>
            </div>

            {/* 4.B FLOATING RISK LEGEND (BOTTOM LEFT) */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-[#D0E2F4] shadow-lg max-w-[260px] text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                <span className="font-bold text-[#12355B] uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#168A8A]" />
                  Risk Classification
                </span>
                <span className="font-mono text-[10px] text-[#536878]">
                  {visibleStats.total} Visible
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-[#17212B]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C94C4C] ring-2 ring-[#C94C4C]/20" />
                    High / Critical (60–100)
                  </span>
                  <span className="font-bold text-[#C94C4C]">{visibleStats.crit + visibleStats.high}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-[#17212B]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E6A23C]" />
                    Medium Risk (30–59)
                  </span>
                  <span className="font-bold text-[#B87D28]">{visibleStats.med}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-[#17212B]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2E8B57]" />
                    Low Risk (0–29)
                  </span>
                  <span className="font-bold text-[#2E8B57]">{visibleStats.low}</span>
                </div>
              </div>

              <div className="text-[10px] text-[#536878] border-t border-[#E2E8F0] pt-1">
                Circle diameter proportional to composite risk.
              </div>
            </div>

          </div>
        </div>

        {/* 5. WORK INTELLIGENCE PROFILE PANEL (RIGHT COLUMN) */}
        {!isExpanded && (
          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
            {activeWork ? (
              /* Selected Project Inspection Card */
              <div className="space-y-4">
                {/* Panel Top Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#12355B] uppercase tracking-wider">
                    <Activity className="w-3.5 h-3.5 text-[#168A8A]" />
                    Work Intelligence Dossier
                  </span>
                  <button
                    onClick={() => setActiveWork(null)}
                    className="p-1 rounded-lg text-[#536878] hover:text-[#17212B] hover:bg-[#F7F9FB] transition-colors"
                    title="Close selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Project Header & Risk Score Banner */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-[#12355B] bg-[#EBF3FB] px-2.5 py-0.5 rounded-lg border border-[#D0E2F4]">
                      {activeWork.work_id}
                    </span>
                    <RiskBadge score={activeWork.overall_risk_score} level={activeWork.risk_level} size="lg" />
                  </div>

                  <h3 className="text-base font-bold text-[#17212B] leading-snug">
                    {activeWork.work_title || 'MPLADS Infrastructure Project'}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-[#536878] mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#168A8A] shrink-0" />
                    <span>{activeWork.village || activeWork.ward ? `${activeWork.village || activeWork.ward}, ` : ''}{activeWork.district}, {activeWork.state}</span>
                  </div>
                </div>

                {/* Financial & Physical Metrics Grid */}
                <div className="bg-[#F7F9FB] p-3.5 rounded-xl border border-[#E2E8F0] space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-[#536878] block">Sanctioned Fund</span>
                      <span className="font-bold text-[#17212B] text-sm">
                        ₹{((activeWork.sanctioned_amount || 0) / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#536878] block">Actual Expenditure</span>
                      <span className="font-bold text-[#17212B] text-sm">
                        ₹{((activeWork.actual_expenditure || 0) / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                  </div>

                  {/* Dual Progress Bars */}
                  <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#536878]">Physical Progress:</span>
                      <span className="font-bold text-[#17212B]">{activeWork.physical_progress || 0}%</span>
                    </div>
                    <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#1F5F8B] h-full rounded-full" 
                        style={{ width: `${Math.min(activeWork.physical_progress || 0, 100)}%` }} 
                      />
                    </div>

                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-[#536878]">Financial Progress:</span>
                      <span className="font-bold text-[#17212B]">{activeWork.financial_progress || 0}%</span>
                    </div>
                    <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#168A8A] h-full rounded-full" 
                        style={{ width: `${Math.min(activeWork.financial_progress || 0, 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Risk Signal & Evidence Banner */}
                {activeWork.primary_risk_factor && (
                  <div className="bg-[#FDF4F4] p-3 rounded-xl border border-[#FADCDA] space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#C94C4C]">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Primary Risk Driver: {activeWork.primary_risk_factor}</span>
                    </div>
                    {activeWork.evidence_summary && activeWork.evidence_summary[0] && (
                      <p className="text-[11px] text-[#536878] leading-relaxed pl-5">
                        {activeWork.evidence_summary[0]}
                      </p>
                    )}
                  </div>
                )}

                {/* Project Metadata Info */}
                <div className="space-y-2 text-xs text-[#536878] py-1 border-t border-[#E2E8F0]">
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-semibold text-[#17212B] text-right truncate max-w-[180px]">
                      {activeWork.work_category || 'General Works'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Implementing Agency:</span>
                    <span className="font-semibold text-[#17212B] text-right truncate max-w-[180px]">
                      {activeWork.implementing_agency || 'DRDA'}
                    </span>
                  </div>
                  {activeWork.mp_name && (
                    <div className="flex justify-between">
                      <span>Hon'ble MP:</span>
                      <span className="font-semibold text-[#17212B] text-right truncate max-w-[180px]">
                        {activeWork.mp_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => onSelectWork(activeWork.work_id)}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#12355B] hover:bg-[#1A497B] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Inspect Full Forensic Dossier</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCenterOnWork(activeWork)}
                    className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-[#1F5F8B] bg-[#F0F7FB] hover:bg-[#E2F0F9] border border-[#D5E8F3] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-[#168A8A]" />
                    <span>Center Marker on Map</span>
                  </button>
                </div>
              </div>
            ) : (
              /* No Work Selected: Regional Overview & Priority Hotspots */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <span className="text-xs font-bold text-[#12355B] uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-[#168A8A]" />
                    Regional Risk Summary
                  </span>
                  <span className="text-xs font-medium text-[#536878]">
                    {selectedDistrict !== 'ALL' ? selectedDistrict : 'National Scope'}
                  </span>
                </div>

                {/* Scope Summary Banner */}
                <div className="bg-[#F7F9FB] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#536878]">Filtered Projects:</span>
                    <span className="font-bold text-[#17212B]">{filtered.length} works</span>
                  </div>

                  {/* Multi-segment Risk Distribution Track */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#536878] mb-1">
                      <span>Risk Spectrum</span>
                      <span>{visibleStats.total > 0 ? `${Math.round(((visibleStats.crit + visibleStats.high) / visibleStats.total) * 100)}% High` : '0%'}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden flex">
                      <div 
                        className="bg-[#C94C4C] h-full" 
                        style={{ width: `${visibleStats.total ? ((visibleStats.crit + visibleStats.high) / visibleStats.total) * 100 : 0}%` }} 
                        title={`High: ${visibleStats.crit + visibleStats.high}`}
                      />
                      <div 
                        className="bg-[#E6A23C] h-full" 
                        style={{ width: `${visibleStats.total ? (visibleStats.med / visibleStats.total) * 100 : 0}%` }} 
                        title={`Medium: ${visibleStats.med}`}
                      />
                      <div 
                        className="bg-[#2E8B57] h-full" 
                        style={{ width: `${visibleStats.total ? (visibleStats.low / visibleStats.total) * 100 : 0}%` }} 
                        title={`Low: ${visibleStats.low}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Priority Flagged Hotspots in View */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#17212B] uppercase tracking-wider">
                      Priority Hotspots in View
                    </span>
                    <span className="text-[11px] text-[#536878]">Highest Risk</span>
                  </div>

                  <div className="space-y-2">
                    {topFlaggedInView.length > 0 ? (
                      topFlaggedInView.map((work) => (
                        <div
                          key={work.work_id}
                          onClick={() => handleCenterOnWork(work)}
                          className="p-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#1F5F8B] hover:bg-[#F0F7FB] transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-[11px] font-bold text-[#12355B]">
                              {work.work_id}
                            </span>
                            <RiskBadge score={work.overall_risk_score} level={work.risk_level} size="sm" />
                          </div>
                          <div className="text-xs font-semibold text-[#17212B] truncate group-hover:text-[#12355B]">
                            {work.work_title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#536878] mt-1">
                            <span>{work.district}, {work.state}</span>
                            <span className="font-semibold text-[#17212B]">₹{((work.sanctioned_amount || 0) / 100000).toFixed(1)}L</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-xs text-[#536878]">
                        No matching projects found in current filter.
                      </div>
                    )}
                  </div>
                </div>

                {/* Guidance Helper Note */}
                <div className="p-3 bg-[#EBF3FB] rounded-xl border border-[#D0E2F4] text-xs text-[#12355B] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#168A8A] shrink-0" />
                  <span className="leading-snug">
                    Click any colored radar node on the map to pin its detailed location dossier.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
