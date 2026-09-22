import { Link } from 'react-router-dom'
import { InvestmentsAssetPage } from './InvestmentsAssetPage'

// Mirrors the main Investments page's structure exactly (stat cards, gain/loss chart,
// account cards, sync/price/export actions) but scoped to crypto — some brokerage
// accounts hold both stocks and a bit of crypto, so this filters by each transaction's
// assetType rather than by whole account (see InvestmentsAssetPage).
export function InvestmentsCrypto() {
  return (
    <InvestmentsAssetPage
      title="Crypto"
      description={
        <>
          Crypto holdings — log them by hand, or{' '}
          <Link to="/transactions/connect-bank" className="font-medium text-[var(--primary)] hover:underline">
            connect a bank
          </Link>{' '}
          (like SoFi Crypto) and hit "Sync from bank" to pull in your trades automatically.
        </>
      }
      isIncluded={(assetType) => assetType === 'crypto'}
      defaultAssetType="crypto"
      defaultAccountType="crypto"
      pdfSubtitle="Crypto"
      filenameSuffix="crypto"
      emptyHint="No crypto holdings yet — add a transaction, or sync from a connected crypto exchange account."
    />
  )
}
