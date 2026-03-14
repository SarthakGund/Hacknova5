"use client"

import { Wallet, Loader2, LogOut, ChevronDown } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { formatAddress } from "@/lib/blockchain"

export default function WalletConnectBtn({ compact = false }: { compact?: boolean }) {
  const { address, isConnecting, error, connect, disconnect } = useWeb3()

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/30 ${compact ? "text-xs" : "text-sm"}`}>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-mono text-green-400">{formatAddress(address)}</span>
        </div>
        <button
          onClick={disconnect}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Disconnect wallet"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={connect}
        disabled={isConnecting}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 ${compact ? "text-xs" : "text-sm"} font-semibold`}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && (
        <p className="text-xs text-destructive mt-1.5 max-w-[220px]">{error}</p>
      )}
    </div>
  )
}
