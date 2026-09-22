import { InvestmentsAssetScreen } from '../src/components/InvestmentsAssetScreen'

// Mirrors the main Investments tab's structure exactly (stats, gain/loss chart, account
// cards, price/export actions) but scoped to crypto — some brokerage accounts hold both
// stocks and a bit of crypto, so this filters by each transaction's assetType rather than
// by whole account (see InvestmentsAssetScreen).
export default function InvestmentsCryptoScreen() {
  return (
    <InvestmentsAssetScreen
      title="Crypto"
      showTitleText={false}
      description="Crypto holdings — log them by hand."
      isIncluded={(assetType) => assetType === 'crypto'}
      defaultAssetType="crypto"
      defaultAccountType="crypto"
      pdfSubtitle="Crypto"
      emptyHint="No crypto holdings yet — add a transaction to get started."
    />
  )
}
