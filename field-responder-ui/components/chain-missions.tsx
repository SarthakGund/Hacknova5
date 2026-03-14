"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, CheckCircle2, Play, Link2, AlertCircle } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import {
  getMissionRegistry, getReadProvider,
  EMERGENCY_TYPES, MISSION_STATUSES,
  STATUS_COLOR, STATUS_BG, fmtTime, shortAddr,
} from "@/lib/blockchain"
import WalletConnectBtn from "./wallet-connect-btn"

type Mission = {
  id: bigint; location: string; volunteer: string; status: number
  emergencyType: number; resourceType: string; aiReasoning: string
  createdAt: bigint; assignedAt: bigint; completedAt: bigint
  porTokenId: bigint; rewardWei: bigint
}

export default function ChainMissions() {
  const { address, signer } = useWeb3()
  const [missions, setMissions] = useState<Mission[]>([])
  const [myMissionIds, setMyMissionIds] = useState<bigint[]>([])
  const [loading, setLoading] = useState(false)
  const [txPending, setTxPending] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const provider = getReadProvider()
      const registry = getMissionRegistry(provider)
      const [result] = await registry.getMissions(0n, 50n)
      setMissions([...result].reverse())
      if (address) {
        const ids: bigint[] = await registry.getVolunteerMissions(address)
        setMyMissionIds(ids)
      }
    } catch (e: any) {
      showToast("Failed to load chain missions: " + (e?.message ?? e), false)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { load() }, [load])

  const sendTx = async (fn: () => Promise<any>, successMsg: string) => {
    if (!signer) return
    setTxPending(successMsg)
    try {
      const tx = await fn()
      await tx.wait()
      showToast(successMsg)
      await load()
    } catch (e: any) {
      showToast(e?.reason ?? e?.message ?? "Transaction failed", false)
    } finally {
      setTxPending(null)
    }
  }

  const accept = (id: bigint) => sendTx(async () => {
    const registry = getMissionRegistry(signer!)
    return registry.assignMission(id)
  }, `Accepted mission #${id}`)

  const start = (id: bigint) => sendTx(async () => {
    return getMissionRegistry(signer!).startMission(id)
  }, `Started mission #${id}`)

  const complete = (id: bigint, resourceType: string) => sendTx(async () => {
    return getMissionRegistry(signer!).completeMission(id, resourceType)
  }, `Mission #${id} completed — PoR NFT minted!`)

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-1">Connect Your Wallet</h3>
          <p className="text-sm text-muted-foreground mb-4">Link MetaMask to accept on-chain missions and earn Proof-of-Relief credentials.</p>
        </div>
        <WalletConnectBtn />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="font-bold text-sm">On-Chain Missions</h2>
          <p className="text-xs text-muted-foreground">{missions.length} total</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-4 mt-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${toast.ok ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-destructive/15 text-destructive border border-destructive/30"}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Pending tx banner */}
      {txPending && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="font-semibold">Sending tx…</span>
          <span className="text-muted-foreground">{txPending}</span>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && missions.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        {!loading && missions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No missions on-chain yet.</div>
        )}
        {missions.map((m) => {
          const isMine = myMissionIds.some(id => id === m.id)
          const isAssignedToMe = m.volunteer.toLowerCase() === address.toLowerCase()
          return (
            <div key={m.id.toString()} className={`rounded-2xl border p-3.5 ${STATUS_BG[m.status]}`}>
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground flex-shrink-0">#{m.id.toString()}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[m.status]} bg-current/10`}>
                    {MISSION_STATUSES[m.status] ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {EMERGENCY_TYPES[m.emergencyType] ?? "Other"}
                  </span>
                </div>
                {m.rewardWei > 0n && (
                  <span className="text-xs text-yellow-400 font-semibold flex-shrink-0">
                    {(Number(m.rewardWei) / 1e18).toFixed(4)} ETH
                  </span>
                )}
              </div>

              {/* Resource + location */}
              <p className="text-sm font-semibold mb-0.5 truncate">{m.resourceType}</p>
              <p className="text-xs text-muted-foreground mb-2 truncate">{m.location}</p>

              {/* AI Reasoning */}
              {m.aiReasoning && (
                <p className="text-xs text-muted-foreground/80 italic mb-2 line-clamp-2">"{m.aiReasoning}"</p>
              )}

              {/* Volunteer + time */}
              {m.volunteer !== "0x0000000000000000000000000000000000000000" && (
                <p className="text-xs text-muted-foreground mb-2">
                  Volunteer: <span className="font-mono">{shortAddr(m.volunteer)}</span>
                  {isAssignedToMe && <span className="ml-1 text-primary">(you)</span>}
                </p>
              )}
              <p className="text-xs text-muted-foreground mb-3">{fmtTime(m.createdAt)}</p>

              {/* NFT badge */}
              {m.status === 3 && m.porTokenId > 0n && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 w-fit">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-green-400 font-semibold">PoR NFT #{m.porTokenId.toString()} minted</span>
                </div>
              )}

              {/* Action buttons */}
              {!txPending && (
                <div className="flex gap-2 flex-wrap">
                  {m.status === 0 && (
                    <button onClick={() => accept(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
                      <Link2 className="w-3.5 h-3.5" /> Accept Mission
                    </button>
                  )}
                  {m.status === 1 && isAssignedToMe && (
                    <button onClick={() => start(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:opacity-90 transition-opacity">
                      <Play className="w-3.5 h-3.5" /> Start En-Route
                    </button>
                  )}
                  {(m.status === 1 || m.status === 2) && isAssignedToMe && (
                    <button onClick={() => complete(m.id, m.resourceType)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:opacity-90 transition-opacity">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete & Mint PoR
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
