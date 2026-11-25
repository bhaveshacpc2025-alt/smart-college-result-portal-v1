import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, QrCode, X, Camera, Keyboard } from 'lucide-react';
import { extractCodeFromInput } from '../utils/api';

export default function QrScannerModal({ isOpen, onClose, onCodeDetected, title = 'Scan Class QR / Enter Invite Code' }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'camera'
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);
  const regionId = 'qr-reader-region';

  useEffect(() => {
    if (!isOpen) {
      setCameraError('');
      return;
    }
    if (mode !== 'camera') return;

    let active = true;
    const html5QrCode = new Html5Qrcode(regionId);
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (!active) return;
          const code = extractCodeFromInput(decodedText);
          if (code) {
            html5QrCode
              .stop()
              .catch(() => {})
              .finally(() => {
                onCodeDetected(code);
                onClose();
              });
          }
        },
        () => {}
      )
      .catch((err) => {
        if (!active) return;
        setCameraError(
          `Camera unavailable (${err?.message || 'permission denied or no camera device'}). Use manual Invite Code / Link below.`
        );
      });

    return () => {
      active = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, mode, onCodeDetected, onClose]);

  if (!isOpen) return null;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = extractCodeFromInput(manualInput);
    if (!code) return;
    onCodeDetected(code);
    setManualInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="bg-navy-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-gold-300" />
            <h3 className="font-semibold text-base">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-navy-700 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'manual' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              Invite Code / Link
            </button>
            <button
              type="button"
              onClick={() => setMode('camera')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'camera' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              Camera QR Scan
            </button>
          </div>

          {mode === 'camera' ? (
            <div className="space-y-3">
              <div
                id={regionId}
                className="w-full min-h-[240px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-950 overflow-hidden flex items-center justify-center text-slate-400 text-xs"
              />
              {cameraError && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  {cameraError}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Paste Class Invite Code or QR Link
                </label>
                <div className="relative">
                  <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. CLS-A1B2C3 or http://.../join?code=CLS-A1B2C3"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-700 focus:border-navy-700 outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                Lookup & Continue
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
