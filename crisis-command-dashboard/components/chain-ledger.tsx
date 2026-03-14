"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2, RefreshCw, CheckCircle2, AlertCircle, Link2, Plus,
  Activity, Shield, Award, TrendingUp,
} from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import {
  getMissionRegistry, getProofOfRelief, getReadProvider,
  EMERGENCY_TYPES, MISSION_STATUSES, STATUS_COLOR, STATUS_BG,
  fmtTime, shortAddr, CHAIN_ID,
} from "@/lib/blockchain"
import WalletConnectBtn from "./wallet-connect-btn"

type Mission = {
  id: bigint; location: string; volunteer: string; status: number
  emergencyType: number; resourceType: string; aiReasoning: string
  createdAt: bigint; completedAt: bigint; porTokenId: bigint; rewardWei: bigint
}

type Stats = {
  total: number; completed: number; active: number; nftsMinted: number; totalRewardEth: number
}

export default function ChainLedger() {
  const { address, signer } = useWeb3()
  const [missions, setMissions] = useState<Mission[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, active: 0, nftsMinted: 0, totalRewardEth: 0 })
  const [loading, setLoading] = useState(false)
  const [txPending, setTxPending] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ location: "", lat: "0", lng: "0", emergencyType: "0", resourceType: "", aiReasoning: "" })

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 5000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const provider = getReadProvider()
      const registry = getMissionRegistry(provider)
      const por = getProofOfRelief(provider)

      const total: bigint = await registry.totalMissions()
      const [result] = await registry.getMissions(0n, total > 100n ? 100n : total)
      const list = [...result].reverse() as Mission[]
      setMissions(list)

      let completed = 0, active = 0, nftsMinted = 0, totalRewardWei = 0n
      for (const m of list) {
        if (Number(m.status) === 3) { completed++; if (m.porTokenId > 0n) nftsMinted++ }
        if (Number(m.status) === 1 || Number(m.status) === 2) active++
        totalRewardWei += m.rewardWei
      }
      setStats({
        total: list.length, completed, active, nftsMinted,
        totalRewardEth: Number(totalRewardWei) / 1e18,
      })
    } catch (e: any) {
      showToast("Failed to load chain data: " + (e?.shortMessage ?? e?.message ?? "RPC error"), false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createMission = async () => {
    if (!signer) return
    setTxPending(true)
    try {
      const registry = getMissionRegistry(signer)
      const tx = await registry.createMission(
        form.location,
        Math.round(parseFloat(form.lat) * 1e6),
        Math.round(parseFloat(form.lng) * 1e6),
        parseInt(form.emergencyType),
        form.resourceType,
        form.aiReasoning,
      )
      await tx.wait()
      showToast("Mission created on-chain!")
      setShowCreate(false)
      setForm({ location: "", lat: "0", lng: "0", emergencyType: "0", resourceType: "", aiReasoning: "" })
      await load()
    } catch (e: any) {
      showToast(e?.reason ?? e?.message ?? "Transaction failed", false)
    } finally {
      setTxPending(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm">Chain Ledger</span>
          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            chainId {CHAIN_ID}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <WalletConnectBtn compact />
          <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-px bg-border flex-shrink-0">
        {[
          { label: "Total", value: stats.total, icon: Activity, color: "text-blue-400" },
          { label: "Active", value: stats.active, icon: TrendingUp, color: "text-orange-400" },
          { label: "Done", value: stats.completed, icon: CheckCircle2, color: "text-green-400" },
          { label: "PoR NFTs", value: stats.nftsMinted, icon: Award, color: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex flex-col items-center justify-center py-3 bg-card gap-0.5">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-lg font-bold leading-none ${color}`}>{value}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-4 mt-2 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${toast.ok ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-destructive/15 text-destructive border border-destructive/30"}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Create Mission panel */}
      {address && (
        <div className="px-4 pt-3 flex-shrink-0">
          <button
            onClick={() => setShowCreate(v => !v)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            {showCreate ? "Cancel" : "Create On-Chain Mission"}
          </button>

          {showCreate && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-bold text-sm">New Mission</h3>
              {[
                { key: "location", label: "Location", placeholder: "e.g. Building B, Sector 7" },
                { key: "resourceType", label: "Resource Type", placeholder: "e.g. insulin, drinking water" },
                { key: "aiReasoning", label: "AI Reasoning", placeholder: "e.g. 5 SOS signals, nearest pharmacy has supply" },
                { key: "lat", label: "Latitude", placeholder: "0.000000" },
                { key: "lng", label: "Longitude", placeholder: "0.000000" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                  <input
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Emergency Type</label>
                <select
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={form.emergencyType}
                  onChange={e => setForm(f => ({ ...f, emergencyType: e.target.value }))}
                >
                  {EMERGENCY_TYPES.map((t, i) => <option key={t} value={i}>{t}</option>)}
                </select>
              </div>
              <button
                onClick={createMission}
                disabled={txPending || !form.location || !form.resourceType}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {txPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {txPending ? "Writing to chain…" : "Submit to Blockchain"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mission list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && missions.length === 0 && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        {!loading && missions.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No missions on blockchain yet.<br />
            <span className="text-xs">Deploy contracts and create a mission above.</span>
          </div>
        )}
        {missions.map((m) => (
          <div key={m.id.toString()} className={`rounded-2xl border p-3.5 ${STATUS_BG[m.status] ?? "bg-card border-border"}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">#{m.id.toString()}</span>
                <span className={`text-xs font-bold ${STATUS_COLOR[m.status] ?? "text-muted-foreground"}`}>
                  {MISSION_STATUSES[m.status] ?? "Unknown"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {EMERGENCY_TYPES[m.emergencyType] ?? "Other"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{fmtTime(m.createdAt)}</span>
            </div>

            <p className="text-sm font-semibold truncate mb-0.5">{m.resourceType}</p>
            <p className="text-xs text-muted-foreground truncate mb-2">{m.location}</p>

            {m.aiReasoning && (
              <p className="text-xs text-muted-foreground/70 italic mb-2 line-clamp-2">"{m.aiReasoning}"</p>
            )}

            {m.volunteer !== "0x0000000000000000000000000000000000000000" && (
              <p className="text-xs text-muted-foreground mb-1">
                Volunteer: <span className="font-mono text-foreground/80">{shortAddr(m.volunteer)}</span>
              </p>
            )}

            {Number(m.status) === 3 && m.porTokenId > 0n && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 w-fit">
                <Award className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs text-yellow-400 font-semibold">PoR NFT #{m.porTokenId.toString()} minted</span>
              </div>
            )}

            {m.rewardWei > 0n && (
              <div className="mt-1.5 text-xs text-yellow-400 font-semibold">
                Reward: {(Number(m.rewardWei) / 1e18).toFixed(4)} ETH
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
