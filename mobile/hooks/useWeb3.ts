import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import * as SecureStore from 'expo-secure-store';
import { getSigner, getProvider, fetchVolunteerBadges, type ReliefBadge } from '@/lib/contracts';
import { CHAIN_ID } from '@/constants/config';

const PKEY_STORE_KEY = 'resqnet_wallet_pk';

export interface Web3State {
  address:    string | null;
  signer:     ethers.Wallet | null;
  chainId:    number;
  balance:    string;
  badges:     ReliefBadge[];
  connected:  boolean;
  loading:    boolean;
  error:      string | null;
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>({
    address: null, signer: null, chainId: CHAIN_ID,
    balance: '0', badges: [], connected: false, loading: false, error: null,
  });

  const _updateBalance = useCallback(async (wallet: ethers.Wallet) => {
    try {
      const bal = await wallet.provider!.getBalance(wallet.address);
      setState(s => ({ ...s, balance: ethers.formatEther(bal) }));
    } catch {}
  }, []);

  const _loadBadges = useCallback(async (address: string) => {
    try {
      const badges = await fetchVolunteerBadges(address, getProvider());
      setState(s => ({ ...s, badges }));
    } catch {}
  }, []);

  /** Restore existing wallet from secure storage */
  const restoreWallet = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const pk = await SecureStore.getItemAsync(PKEY_STORE_KEY);
      if (!pk) { setState(s => ({ ...s, loading: false })); return; }
      const wallet = getSigner(pk);
      setState(s => ({
        ...s, signer: wallet, address: wallet.address,
        connected: true, loading: false,
      }));
      _updateBalance(wallet);
      _loadBadges(wallet.address);
    } catch (e: unknown) {
      setState(s => ({ ...s, loading: false, error: String(e) }));
    }
  }, [_updateBalance, _loadBadges]);

  /** Import wallet via private key */
  const importWallet = useCallback(async (privateKey: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const wallet = getSigner(privateKey);
      await SecureStore.setItemAsync(PKEY_STORE_KEY, privateKey);
      setState(s => ({
        ...s, signer: wallet, address: wallet.address,
        connected: true, loading: false,
      }));
      _updateBalance(wallet);
      _loadBadges(wallet.address);
    } catch (e: unknown) {
      setState(s => ({ ...s, loading: false, error: 'Invalid private key' }));
    }
  }, [_updateBalance, _loadBadges]);

  /** Generate a brand-new random wallet */
  const createWallet = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const wallet = ethers.Wallet.createRandom().connect(getProvider());
      await SecureStore.setItemAsync(PKEY_STORE_KEY, wallet.privateKey);
      setState(s => ({
        ...s, signer: wallet as unknown as ethers.Wallet,
        address: wallet.address, connected: true, loading: false,
      }));
    } catch (e: unknown) {
      setState(s => ({ ...s, loading: false, error: String(e) }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync(PKEY_STORE_KEY);
    setState(s => ({ ...s, signer: null, address: null, connected: false, balance: '0', badges: [] }));
  }, []);

  const refreshBalance = useCallback(() => {
    if (state.signer) _updateBalance(state.signer);
  }, [state.signer, _updateBalance]);

  const refreshBadges = useCallback(() => {
    if (state.address) _loadBadges(state.address);
  }, [state.address, _loadBadges]);

  useEffect(() => { restoreWallet(); }, []);

  return { ...state, importWallet, createWallet, disconnect, refreshBalance, refreshBadges };
}
