"use client"

import { useState, useEffect, useCallback } from "react"
import { Award, Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { getMissionRegistry, getProofOfRelief, getReadProvider, fmtTime, shortAddr } from "@/lib/blockchain"
import WalletConnectBtn from "./wallet-connect-btn"

type Credential = {
  tokenId: bigint
  missionId: bigint
  location: string
  aidType: string
  timestamp: bigint
}

export default function PorCredentials() {
  const { address } = useWeb3()
  const [creds, setCreds] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const provider = getReadProvider()
      const registry = getMissionRegistry(provider)
      const por = getProofOfRelief(provider)

      // Get all mission IDs this volunteer was assigned to
      const ids: bigint[] = await registry.getVolunteerMissions(address)

      // For each completed mission, grab the porTokenId and relief data
      const results: Credential[] = []
      for (const id of ids) {
        try {
          const m = await registry.getMission(id)
          if (m.status === 3n || Number(m.status) === 3) {
            const tokenId: bigint = m.porTokenId
            if (tokenId > 0n) {
              // Try reliefData if available, else fallback to mission data
              try {
                const rd = await por.reliefData(tokenId)
                results.push({
                  tokenId,
                  missionId: rd.missionId,
                  location: rd.location,
                  aidType: rd.aidType,
                  timestamp: rd.timestamp,
                })
              } catch {
                results.push({
                  tokenId,
                  missionId: m.id,
                  location: m.location,
                  aidType: m.resourceType,
                  timestamp: m.completedAt,
                })
              }
            }
          }
        } catch { /* skip */ }
      }
      setCreds(results)
      setTotal(results.length)
    } catch (e: any) {
      console.error("PoR load error:", e)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { load() }, [load])

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
        <Award className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect your wallet to view on-chain Proof-of-Relief credentials.</p>
        <WalletConnectBtn compact />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-sm">Proof-of-Relief Credentials</span>
          {total > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-bold">{total}</span>
          )}
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && creds.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No credentials yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Complete on-chain missions to earn PoR NFTs.</p>
        </div>
      )}

      <div className="space-y-2">
        {creds.map((c) => (
          <div key={c.tokenId.toString()} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold text-sm">NFT #{c.tokenId.toString()}</span>
                <span className="text-xs text-muted-foreground font-mono">Mission #{c.missionId.toString()}</span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{fmtTime(c.timestamp)}</span>
            </div>
            <p className="text-sm font-semibold truncate mb-0.5">{c.aidType}</p>
            <p className="text-xs text-muted-foreground truncate">{c.location}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
