import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Trash2, RefreshCw, Copy, Check,
  Eye, EyeOff, AlertTriangle, Clock, RotateCw, Info
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { apiService } from '../services/apiService';

interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  scope: 'read' | 'read_admin';
  project_ids: number[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface NewKeyResult {
  id: number;
  name: string;
  api_key: string;
  key_prefix: string;
  scope: string;
  project_ids: number[];
  expires_at: string | null;
}

interface ProjectOption {
  id: number;
  name: string;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

const isExpired = (expires_at: string | null) =>
  !!expires_at && new Date(expires_at) < new Date();

const isRevoked = (key: ApiKey) => !!key.revoked_at;

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
      type="button"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export function ApiKeyManager() {
  const { showToast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'read' | 'read_admin'>('read');
  const [newProjects, setNewProjects] = useState<number[]>([]);
  const [noExpiry, setNoExpiry] = useState(false);
  const [newExpiry, setNewExpiry] = useState('');

  const [revealKey, setRevealKey] = useState<NewKeyResult | null>(null);
  const [revealTitle, setRevealTitle] = useState('API Key Created');
  const [keyVisible, setKeyVisible] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [rotatingId, setRotatingId] = useState<number | null>(null);

  const projectName = (id: number) => projects.find((project) => project.id === id)?.name || `Project ${id}`;

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const [keyRes, projectRes] = await Promise.all([
        apiService.get('/admin/powerbi-keys'),
        apiService.get('/projects?limit=500'),
      ]);
      const projectRows = Array.isArray(projectRes.data) ? projectRes.data : [];
      setProjects(projectRows.map((project: { id: number; name: string }) => ({
        id: Number(project.id),
        name: project.name,
      })));
      setKeys(keyRes.data || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load API keys', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const resetCreate = () => {
    setCreateOpen(false);
    setNewName('');
    setNewScope('read');
    setNewProjects([]);
    setNoExpiry(false);
    setNewExpiry('');
  };

  const toggleProject = (id: number) => {
    setNewProjects((current) => (
      current.includes(id) ? current.filter((projectId) => projectId !== id) : [...current, id]
    ));
  };

  const handleCreate = async () => {
    if (!newName.trim() || newProjects.length === 0) return;
    try {
      setCreating(true);
      const res = await apiService.post('/admin/powerbi-keys', {
        name: newName.trim(),
        project_ids: newProjects,
        scope: newScope,
        no_expiry: noExpiry,
        expires_at: !noExpiry && newExpiry ? newExpiry : undefined,
      });
      setRevealTitle('API Key Created');
      setRevealKey(res.data);
      setKeyVisible(false);
      resetCreate();
      await loadKeys();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create API key', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (key: ApiKey) => {
    try {
      setRotatingId(key.id);
      const res = await apiService.post(`/admin/powerbi-keys/${key.id}/rotate`, {});
      setRevealTitle('API Key Rotated');
      setRevealKey(res.data);
      setKeyVisible(false);
      showToast(`Key "${key.name}" rotated. Copy the new key now.`, 'success');
      await loadKeys();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to rotate key', 'error');
    } finally {
      setRotatingId(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      await apiService.delete(`/admin/powerbi-keys/${revokeTarget.id}`);
      showToast(`Key "${revokeTarget.name}" revoked`, 'success');
      setRevokeTarget(null);
      await loadKeys();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to revoke key', 'error');
    } finally {
      setRevoking(false);
    }
  };

  const statusBadge = (key: ApiKey) => {
    if (isRevoked(key)) return <Badge variant="danger">Revoked</Badge>;
    if (isExpired(key.expires_at)) return <Badge variant="warning">Expired</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  const canManage = (key: ApiKey) => !isRevoked(key) && !isExpired(key.expires_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Create read-only keys for the Power BI data API. Each key is limited to the projects you select.
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

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How to use API keys</p>
          <p>Send the key in the <code className="bg-blue-100 px-1 rounded">X-API-Key</code> header.</p>
          <p className="mt-1 text-blue-700">
            Example: <code className="bg-blue-100 px-1 rounded">GET /api/v1/projects/58/tasks</code>
          </p>
          <p className="mt-1 text-blue-700">The full key is shown once, at creation or rotation. Revoked keys stop working immediately.</p>
        </div>
      </div>

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
              <p className="text-gray-400 text-sm mt-1">Create a key for Power BI or another read-only client</p>
              <Button className="mt-4" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
                Create API Key
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Key Prefix', 'Scope', 'Projects', 'Status', 'Last Used', 'Expires', 'Created', ''].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keys.map((key) => (
                    <tr key={key.id} className={`hover:bg-gray-50 transition-colors ${!canManage(key) ? 'opacity-60' : ''}`}>
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
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600">
                        {key.scope === 'read_admin' ? 'Read + private' : 'Read'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-[220px]">
                        {(key.project_ids || []).map(projectName).join(', ') || '—'}
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
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(key.created_at)}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {canManage(key) && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              loading={rotatingId === key.id}
                              icon={<RotateCw className="w-4 h-4" />}
                              onClick={() => handleRotate(key)}
                            >
                              Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setRevokeTarget(key)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={createOpen} onClose={resetCreate} title="Create API Key">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Power BI English"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={newScope}
              onChange={(event) => setNewScope(event.target.value as 'read' | 'read_admin')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="read">Read — public remarks only</option>
              <option value="read_admin">Read + private remarks</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projects <span className="text-red-500">*</span></label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No projects found</p>
              ) : projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={newProjects.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                  />
                  <span>{project.name}</span>
                  <span className="text-gray-400">#{project.id}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <input type="checkbox" checked={noExpiry} onChange={(event) => setNoExpiry(event.target.checked)} />
              No expiry
            </label>
            {!noExpiry && (
              <input
                type="date"
                value={newExpiry}
                onChange={(event) => setNewExpiry(event.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {!noExpiry && !newExpiry && (
              <p className="text-xs text-gray-400 mt-1">Leave the date blank to expire the key after 90 days.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetCreate}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!newName.trim() || newProjects.length === 0}>
              Generate Key
            </Button>
          </div>
        </div>
      </Modal>

      {revealKey && (
        <Modal isOpen={!!revealKey} onClose={() => setRevealKey(null)} title={revealTitle}>
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
                  {keyVisible ? revealKey.api_key : '•'.repeat(Math.min(revealKey.api_key.length, 48))}
                </code>
                <button
                  type="button"
                  onClick={() => setKeyVisible((visible) => !visible)}
                  className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  title={keyVisible ? 'Hide' : 'Show'}
                >
                  {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <CopyButton text={revealKey.api_key} />
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-semibold text-gray-700 mb-1">Usage</p>
              <p>Header: <code className="bg-gray-100 px-1 rounded">X-API-Key: {revealKey.api_key.slice(0, 12)}…</code></p>
              <p>Projects: {(revealKey.project_ids || []).join(', ')}</p>
              <p>Scope: {revealKey.scope === 'read_admin' ? 'Read + private remarks' : 'Read'}</p>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={() => setRevealKey(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {revokeTarget && (
        <Modal isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke API Key">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Revoke <strong>{revokeTarget.name}</strong>?</p>
                <p className="mt-1 text-red-700">Power BI and any other client using this key lose access immediately. Issue a new key if they still need access.</p>
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
