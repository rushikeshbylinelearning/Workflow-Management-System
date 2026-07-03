import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Trash2, RefreshCw, Copy, Check,
  Eye, EyeOff, AlertTriangle, Clock, CheckCircle,
  XCircle, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { apiService } from '../services/apiService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string;
}

interface NewKeyResult {
  name: string;
  api_key: string;
  key_prefix: string;
  expires_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

const isExpired = (expires_at: string | null) =>
  !!expires_at && new Date(expires_at) < new Date();

// ─── Sub-component: copy button ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ApiKeyManager() {
  const { showToast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  // Reveal modal (shown once after creation)
  const [revealKey, setRevealKey] = useState<NewKeyResult | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ── Load keys ──────────────────────────────────────────────────────────────
  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.get('/api-keys');
      setKeys(res.data || []);
    } catch {
      showToast('Failed to load API keys', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const res = await apiService.post('/api-keys', {
        name: newName.trim(),
        expires_at: newExpiry || null,
      });
      setRevealKey(res.data);
      setKeyVisible(false);
      setCreateOpen(false);
      setNewName('');
      setNewExpiry('');
      await loadKeys();
    } catch {
      showToast('Failed to create API key', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── Revoke ─────────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      await apiService.delete(`/api-keys/${revokeTarget.id}`);
      showToast(`Key "${revokeTarget.name}" revoked`, 'success');
      setRevokeTarget(null);
      await loadKeys();
    } catch {
      showToast('Failed to revoke key', 'error');
    } finally {
      setRevoking(false);
    }
  };

  // ── Re-activate ────────────────────────────────────────────────────────────
  const handleActivate = async (key: ApiKey) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api'}/api-keys/${key.id}/activate`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}`,
          },
        }
      );
      if (!response.ok) throw new Error();
      showToast(`Key "${key.name}" re-activated`, 'success');
      await loadKeys();
    } catch {
      showToast('Failed to activate key', 'error');
    }
  };

  // ── Status badge ───────────────────────────────────────────────────────────
  const statusBadge = (key: ApiKey) => {
    if (!key.is_active)       return <Badge variant="danger">Revoked</Badge>;
    if (isExpired(key.expires_at)) return <Badge variant="warning">Expired</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Use API keys to access the Dashboard API from external applications without logging in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadKeys}>
            Refresh
          </Button>
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            New API Key
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How to use API keys</p>
          <p>Pass the key in the <code className="bg-blue-100 px-1 rounded">X-API-Key</code> request header, or as a <code className="bg-blue-100 px-1 rounded">?api_key=</code> query parameter.</p>
          <p className="mt-1 text-blue-700">All <code className="bg-blue-100 px-1 rounded">/api/dashboard/*</code> endpoints are accessible with a valid key.</p>
        </div>
      </div>

      {/* Keys table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No API keys yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first key to get started</p>
              <Button className="mt-4" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
                Create API Key
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Key Prefix', 'Status', 'Last Used', 'Expires', 'Created By', 'Created', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keys.map(key => (
                    <tr key={key.id} className={`hover:bg-gray-50 transition-colors ${!key.is_active || isExpired(key.expires_at) ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-gray-400 shrink-0" />
                          {key.name}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                          {key.key_prefix}…
                        </code>
                      </td>
                      <td className="px-5 py-3.5">{statusBadge(key)}</td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                        {key.last_used_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(key.last_used_at)}
                          </span>
                        ) : <span className="text-gray-400">Never</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                        {key.expires_at ? (
                          <span className={isExpired(key.expires_at) ? 'text-red-500' : ''}>
                            {formatDate(key.expires_at)}
                          </span>
                        ) : <span className="text-gray-400">Never</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{key.created_by}</td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(key.created_at)}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {!key.is_active && (
                            <Button variant="outline" size="sm" onClick={() => handleActivate(key)}>
                              Activate
                            </Button>
                          )}
                          {key.is_active && !isExpired(key.expires_at) && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setRevokeTarget(key)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setNewName(''); setNewExpiry(''); }} title="Create API Key">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. PM Dashboard Key"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date <span className="text-gray-400 font-normal">(optional — leave blank for no expiry)</span>
            </label>
            <input
              type="date"
              value={newExpiry}
              onChange={e => setNewExpiry(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setNewName(''); setNewExpiry(''); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
              Generate Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Reveal modal (shown once) ─────────────────────────────────────────── */}
      {revealKey && (
        <Modal isOpen={!!revealKey} onClose={() => setRevealKey(null)} title="API Key Created">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                Copy this key now — it will <strong>not</strong> be shown again after you close this dialog.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Key Name</label>
              <p className="text-sm font-medium text-gray-900">{revealKey.name}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">API Key</label>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                  {keyVisible ? revealKey.api_key : '•'.repeat(revealKey.api_key.length)}
                </code>
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  title={keyVisible ? 'Hide' : 'Show'}
                >
                  {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <CopyButton text={revealKey.api_key} />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-semibold text-gray-700 mb-1">Usage examples</p>
              <p>Header: <code className="bg-gray-100 px-1 rounded">X-API-Key: {revealKey.api_key.slice(0, 12)}…</code></p>
              <p>Query:  <code className="bg-gray-100 px-1 rounded">?api_key={revealKey.api_key.slice(0, 12)}…</code></p>
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={() => setRevealKey(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Revoke confirm modal ──────────────────────────────────────────────── */}
      {revokeTarget && (
        <Modal isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke API Key">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Revoke <strong>{revokeTarget.name}</strong>?</p>
                <p className="mt-1 text-red-700">Any application using this key will immediately lose access. This action can be undone by re-activating the key.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
              <Button variant="danger" loading={revoking} onClick={handleRevoke}>
                Revoke Key
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
