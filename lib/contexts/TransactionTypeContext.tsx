import React, { createContext, useContext, useState } from 'react';

type TransactionType = 'buy' | 'sell' | null;

interface TransactionTypeContextValue {
  transactionType: TransactionType;
  setTransactionType: (type: TransactionType) => void;
}

const TransactionTypeContext = createContext<TransactionTypeContextValue>({
  transactionType: null,
  setTransactionType: () => {},
});

export function TransactionTypeProvider({ children }: { children: React.ReactNode }) {
  const [transactionType, setTransactionType] = useState<TransactionType>(null);

  return (
    <TransactionTypeContext.Provider value={{ transactionType, setTransactionType }}>
      {children}
    </TransactionTypeContext.Provider>
  );
}

export function useTransactionType() {
  return useContext(TransactionTypeContext);
}
