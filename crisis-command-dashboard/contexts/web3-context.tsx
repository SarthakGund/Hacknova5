"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { BrowserProvider, Signer } from "ethers"
import { CHAIN_ID } from "@/lib/blockchain"

interface Web3Ctx {
  address: string | null
  signer: Signer | null
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const Web3Context = createContext<Web3Ctx>({
  address: null, signer: null, isConnecting: false, error: null,
  connect: async () => {}, disconnect: () => {},
})

export function Web3Provider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [signer, setSigner] = useState<Signer | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum
    if (!eth) {
      setError("MetaMask not detected. Install MetaMask to use blockchain features.")
      return
    }
    setIsConnecting(true)
    setError(null)
    try {
      const provider = new BrowserProvider(eth)
      await provider.send("eth_requestAccounts", [])
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          })
        } catch {
          setError(`Please switch MetaMask to Hardhat network (chainId ${CHAIN_ID}).`)
          setIsConnecting(false)
          return
        }
      }
      const s = await provider.getSigner()
      setAddress(await s.getAddress())
      setSigner(s)
    } catch (e: any) {
      setError(e?.message ?? "Connection failed")
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null); setSigner(null); setError(null)
  }, [])

  return (
    <Web3Context.Provider value={{ address, signer, isConnecting, error, connect, disconnect }}>
      {children}
    </Web3Context.Provider>
  )
}

export const useWeb3 = () => useContext(Web3Context)
