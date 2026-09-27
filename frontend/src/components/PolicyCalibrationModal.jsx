import React, { useState } from 'react';
import { X, Sliders, RefreshCw, CheckCircle2, Sparkles, HelpCircle } from 'lucide-react';
import { recalculateRiskWeights } from '../api/client';

export default function PolicyCalibrationModal({ isOpen, onClose, onWeightsApplied }) {
  const [finWeight, setFinWeight] = useState(30);
  const [delayWeight, setDelayWeight] = useState(30);
  const [dupWeight, setDupWeight] = useState(25);
  const [compWeight, setCompWeight] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const total = finWeight + delayWeight + dupWeight + compWeight;

  const handleApply = async () => {
    setIsSubmitting(true);
    setSuccessMsg("");
    try {
      await recalculateRiskWeights({
        weight_financial: finWeight,
        weight_delay: delayWeight,
        weight_duplicate: dupWeight,
        weight_compliance: compWeight
      });
      setSuccessMsg("Risk weights recalculated across all 520 projects!");
      setTimeout(() => {
        onWeightsApplied();
        onClose();
      }, 1000);
    } catch (err) {
      alert("Failed to recalculate: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFinWeight(30);
    setDelayWeight(30);
    setDupWeight(25);
    setCompWeight(15);
  };


  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-2xl w-full max-w-lg shadow-xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E4DC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#4B3C32]/10 text-[#4B3C32] border border-[#4B3C32]/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#050505] tracking-tight">
                Interactive Policy Calibration Engine
              </h3>
              <p className="text-xs text-[#5E5E5D]">
                Adjust module weights to calibrate dynamic risk scoring across live projects.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#5E5E5D] hover:text-[#050505] hover:bg-[#E8E4DC]/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sliders Container */}
        <div className="space-y-4">
          
          {/* Financial Weight */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#050505]">Financial & Cost Anomaly Weight</span>
              <span className="text-[#4B3C32] font-mono">{finWeight}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={finWeight}
              onChange={(e) => setFinWeight(Number(e.target.value))}
              className="w-full accent-[#4B3C32] cursor-pointer"
            />
          </div>

          {/* Delay Weight */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#050505]">Delay & Stagnation Weight</span>
              <span className="text-[#4B3C32] font-mono">{delayWeight}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={delayWeight}
              onChange={(e) => setDelayWeight(Number(e.target.value))}
              className="w-full accent-[#4B3C32] cursor-pointer"
            />
          </div>

          {/* Duplicate Weight */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#050505]">Duplicate / Overlap Weight</span>
              <span className="text-[#4B3C32] font-mono">{dupWeight}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={dupWeight}
              onChange={(e) => setDupWeight(Number(e.target.value))}
              className="w-full accent-[#4B3C32] cursor-pointer"
            />
          </div>

          {/* Compliance Weight */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-[#050505]">Compliance & Certificates Weight</span>
              <span className="text-[#4B3C32] font-mono">{compWeight}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={compWeight}
              onChange={(e) => setCompWeight(Number(e.target.value))}
              className="w-full accent-[#4B3C32] cursor-pointer"
            />
          </div>

        </div>

        {/* Total & Feedback */}
        <div className="mt-5 p-3 rounded-xl bg-[#F7F7F1]/60 border border-[#E8E4DC] flex items-center justify-between">
          <span className="text-xs text-[#5E5E5D]">Total Normalized Weight:</span>
          <span className={`font-mono font-bold text-sm ${total === 100 ? "text-[#2E8B57]" : "text-[#916540]"}`}>
            {total}% {total === 100 ? "(Balanced)" : "(Scaled)"}
          </span>
        </div>

        {successMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-[#2E8B57]/10 border border-[#2E8B57]/25 text-[#2E8B57] text-xs text-center flex items-center justify-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 mt-5 pt-3 border-t border-[#E8E4DC]">
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-[#5E5E5D] hover:text-[#050505] transition-colors"
          >
            Reset Defaults
          </button>
          <button
            disabled={isSubmitting}
            onClick={handleApply}
            className="btn-primary flex items-center gap-2 py-2 px-5 text-xs font-bold disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Recalculate System</span>
          </button>
        </div>

      </div>
    </div>
  );
}
