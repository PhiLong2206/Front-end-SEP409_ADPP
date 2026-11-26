import { useContext } from "react";
import { CreditContext, CreditContextType } from "../context/CreditContext";

const defaultCreditContext: CreditContextType = {
  balance: null,
  walletId: null,
  loading: false,
  latestTransaction: null,
  refreshBalance: async () => null,
  setBalance: () => {},
};

export const useCredit = (): CreditContextType => {
  const context = useContext(CreditContext);
  return context ?? defaultCreditContext;
};

export default useCredit;
