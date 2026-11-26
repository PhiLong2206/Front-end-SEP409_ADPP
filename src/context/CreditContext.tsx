import React, { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import paymentApi from "../api/paymentApi";
import { useAuth } from "../hooks/useAuth";
import { creditHub, CreditBalanceUpdatedEvent, CreditTransactionCreatedEvent } from "../services/creditHub";

export interface CreditContextType {
  balance: number | null;
  walletId: number | null;
  loading: boolean;
  latestTransaction: CreditTransactionCreatedEvent | null;
  refreshBalance: () => Promise<number | null>;
  setBalance: (newBalance: number) => void;
}

export const CreditContext = createContext<CreditContextType | null>(null);

export const CreditProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [balance, setBalanceState] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [latestTransaction, setLatestTransaction] = useState<CreditTransactionCreatedEvent | null>(null);

  const refreshBalance = useCallback(async (): Promise<number | null> => {
    if (!isAuthenticated) {
      setBalanceState(null);
      setWalletId(null);
      return null;
    }

    setLoading(true);
    try {
      const res = await paymentApi.getMyWallet();
      if (res && res.success && res.data) {
        setBalanceState(res.data.balance);
        setWalletId(res.data.walletId);
        return res.data.balance;
      }
      return null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const setBalance = useCallback((newBalance: number) => {
    setBalanceState(newBalance);
  }, []);

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshBalance();
    } else {
      setBalanceState(null);
      setWalletId(null);
      setLatestTransaction(null);
    }
  }, [isAuthenticated, refreshBalance]);

  // Connect to SignalR credit hub and listen for live events
  useEffect(() => {
    if (!isAuthenticated || !user) {
      creditHub.disconnect();
      return;
    }

    creditHub.connect();

    const unsubBalance = creditHub.onBalanceUpdated((event: CreditBalanceUpdatedEvent) => {
      if (typeof event.balance === "number") {
        setBalanceState(event.balance);
      }
    });

    const unsubTx = creditHub.onTransactionCreated((tx: CreditTransactionCreatedEvent) => {
      setLatestTransaction(tx);
      if (typeof tx.balanceAfter === "number") {
        setBalanceState(tx.balanceAfter);
      }
    });

    const unsubReconnect = creditHub.onReconnect(() => {
      refreshBalance();
    });

    // Also support global DOM event for components dispatching legacy 'wallet_updated'
    const handleLegacyWalletUpdate = () => {
      refreshBalance();
    };
    window.addEventListener("wallet_updated", handleLegacyWalletUpdate);

    return () => {
      unsubBalance();
      unsubTx();
      unsubReconnect();
      window.removeEventListener("wallet_updated", handleLegacyWalletUpdate);
    };
  }, [isAuthenticated, user, refreshBalance]);

  return (
    <CreditContext.Provider
      value={{
        balance,
        walletId,
        loading,
        latestTransaction,
        refreshBalance,
        setBalance,
      }}
    >
      {children}
    </CreditContext.Provider>
  );
};
