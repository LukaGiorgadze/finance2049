export type ExtractionMode = 'transactions' | 'portfolio_summary' | 'none';

export type ImportedTxExtractionMode = Exclude<ExtractionMode, 'none'>;
