import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePlaidLink } from 'react-plaid-link'
import { Landmark, RefreshCw, Trash2, Upload } from 'lucide-react'
import {
  createPlaidLinkToken,
  disconnectPlaidBank,
  exchangePlaidPublicToken,
  fetchPlaidConnections,
  syncPlaidTransactions,
} from '../data/api'
import { useSession } from '../hooks/useSession'
import { Card } from '../components/Card'

export function ConnectBank() {
  const { session } = useSession()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  const plaidConnectionsQuery = useQuery({
    queryKey: ['plaid-connections', userId],
    queryFn: fetchPlaidConnections,
    enabled: Boolean(userId),
  })
  const syncMutation = useMutation({
    mutationFn: syncPlaidTransactions,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', userId] })
      window.alert(`Synced ${result.synced} transaction${result.synced === 1 ? '' : 's'}.`)
    },
    onError: (err) => window.alert(err instanceof Error ? err.message : 'Sync failed.'),
  })
  const disconnectMutation = useMutation({
    mutationFn: disconnectPlaidBank,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plaid-connections', userId] }),
    onError: (err) => window.alert(err instanceof Error ? err.message : 'Could not disconnect that bank.'),
  })

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">Connect to bank</h1>
        <p className="text-[13px] text-[var(--text-soft)]">Link a bank account to import transactions automatically.</p>
      </div>

      <Card title="Connected banks">
        <div className="space-y-3">
          {plaidConnectionsQuery.data?.length ? (
            <ul className="space-y-2">
              {plaidConnectionsQuery.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[13px] text-[var(--text)]">
                  <span className="flex items-center gap-1.5">
                    <Landmark size={14} className="text-[var(--text-soft)]" />
                    {c.institutionName ?? 'Connected account'}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-soft)]">
                      since {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Disconnect ${c.institutionName ?? 'this bank'}? Past synced transactions stay.`)) {
                          disconnectMutation.mutate(c.id)
                        }
                      }}
                      disabled={disconnectMutation.isPending}
                      title="Disconnect"
                      className="text-[var(--text-soft)] hover:text-[var(--warn)] disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--text-soft)]">
              No banks connected — connect one to import transactions automatically.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <ConnectBankButton
              onConnected={() => {
                queryClient.invalidateQueries({ queryKey: ['plaid-connections', userId] })
                syncMutation.mutate()
              }}
            />
            {plaidConnectionsQuery.data?.length ? (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
              >
                <RefreshCw size={15} /> {syncMutation.isPending ? 'Syncing…' : 'Sync now'}
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      <p className="text-[12.5px] text-[var(--text-soft)]">
        Not comfortable linking your bank account? You can{' '}
        <Link to="/transactions/upload-docs" className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline">
          <Upload size={12} /> upload a CSV statement
        </Link>{' '}
        instead — nothing is shared with a third party, and you choose what gets imported.
      </p>
    </div>
  )
}

// Chase and most major banks use Plaid's OAuth flow: the browser leaves this page
// entirely for the bank's real login, then comes back with an oauth_state_id in the
// URL. The link token has to survive that round trip (React state doesn't), so it's
// stashed in sessionStorage before redirecting and picked back up on the resumed load.
const REDIRECT_URI = `${window.location.origin}/transactions/connect-bank`
const PENDING_TOKEN_KEY = 'plaid-link-token-pending'

function ConnectBankButton({ onConnected }: { onConnected: () => void }) {
  const isOAuthResume = window.location.search.includes('oauth_state_id')
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    isOAuthResume ? sessionStorage.getItem(PENDING_TOKEN_KEY) : null,
  )
  const [starting, setStarting] = useState(false)

  const exchangeMutation = useMutation({
    mutationFn: ({ publicToken, institutionName }: { publicToken: string; institutionName: string | null }) =>
      exchangePlaidPublicToken(publicToken, institutionName),
    onSuccess: () => {
      sessionStorage.removeItem(PENDING_TOKEN_KEY)
      setLinkToken(null)
      onConnected()
    },
    onError: (err) => {
      sessionStorage.removeItem(PENDING_TOKEN_KEY)
      setLinkToken(null)
      window.alert(err instanceof Error ? err.message : 'Could not connect that bank account.')
    },
  })

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    receivedRedirectUri: isOAuthResume ? window.location.href : undefined,
    onSuccess: (publicToken, metadata) => {
      if (!publicToken) return
      exchangeMutation.mutate({ publicToken, institutionName: metadata.institution?.name ?? null })
    },
    onExit: () => {
      sessionStorage.removeItem(PENDING_TOKEN_KEY)
      setLinkToken(null)
    },
  })

  useEffect(() => {
    if (linkToken && ready) {
      open()
      if (isOAuthResume) window.history.replaceState(null, '', window.location.pathname)
    }
  }, [linkToken, ready, open, isOAuthResume])

  const startLink = async () => {
    setStarting(true)
    try {
      const token = await createPlaidLinkToken(REDIRECT_URI)
      sessionStorage.setItem(PENDING_TOKEN_KEY, token)
      setLinkToken(token)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not start bank connection.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <button
      onClick={startLink}
      disabled={starting || exchangeMutation.isPending}
      className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
    >
      <Landmark size={15} />
      {starting ? 'Starting…' : exchangeMutation.isPending ? 'Connecting…' : 'Connect a bank'}
    </button>
  )
}
