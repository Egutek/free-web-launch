import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNetworkStatusWithSync } from "../services/offlineSync";

export const OfflineIndicator: React.FC = () => {
  const { isOnline, pendingCount, isFlushing, triggerSync } = useNetworkStatusWithSync();
  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  useEffect(() => {
    // If transitioned from offline to online
    if (!prevOnline && isOnline) {
      setShowSyncedToast(true);
      const timer = setTimeout(() => setShowSyncedToast(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevOnline(isOnline);
  }, [isOnline, prevOnline]);

  if (showSyncedToast) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-semibold border border-emerald-500/50">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white animate-bounce" />
          <span>Wi-Fi signál obnoven – Všechny změny byly odeslány do cloudu.</span>
        </div>
      </div>
    );
  }

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl shadow-xl text-xs font-medium border backdrop-blur-md ${
          !isOnline
            ? "bg-amber-950/90 text-amber-200 border-amber-600/50"
            : "bg-blue-950/90 text-blue-200 border-blue-600/50"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {!isOnline ? (
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold truncate text-[11px] sm:text-xs">
              {!isOnline ? "Slabý signál v uličce (Offline režim)" : "Čeká na odeslání do cloudu"}
            </div>
            <div className="text-[10px] opacity-80 truncate">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? "změna čeká" : pendingCount < 5 ? "změny čekají" : "změn čeká"} na synchronizaci`
                : "Změny jsou bezpečně uloženy v telefonu"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => triggerSync()}
          disabled={isFlushing}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-[11px] font-bold cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isFlushing ? "animate-spin" : ""}`} />
          <span>{isFlushing ? "Odesílám..." : "Odeslat"}</span>
        </button>
      </div>
    </div>
  );
};
