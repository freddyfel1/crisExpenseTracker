import { InvestmentsAssetScreen } from '../../src/components/InvestmentsAssetScreen'

export default function InvestmentsScreen() {
  return (
    <InvestmentsAssetScreen
      title="Investments"
      description="ETFs and other holdings you track by hand. Tracking crypto? Visit the Crypto screen."
      isIncluded={(assetType) => assetType !== 'crypto'}
      defaultAssetType="etf"
      isDefaultAccountType={(accountType) => accountType !== 'crypto'}
      newAccountType="brokerage"
      pdfSubtitle="Investments"
      emptyHint="No investment accounts yet — add one to start logging buys and sells."
      sectionLabel="Stocks, ETFs & other"
      footerLink={{ label: 'Visit the Crypto screen →', href: '/investments-crypto' }}
    />
  )
}
