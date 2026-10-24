import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Trash2, RefreshCw, Copy, Check, Eye, EyeOff, AlertTriangle, RotateCw,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { apiService } from '../services/apiService';

interface ReportingKey {
  id: number;
  name: string;
  keyPrefix: string;
  projectIds: Array<number | 'all'>;
  allProjects?: boolean;
  fieldGroups: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface FieldMeta {
  fieldName: string;
  displayName: string;
  group: string;
  sensitive: boolean;
  default: boolean;
}

interface ProjectOption {
  id: number;
  name: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-500"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export function ReportingApiManager() {
  const { showToast } = useToast();
  const [keys, setKeys] = useState<ReportingKey[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProjects, setNewProjects] = useState<number[]>([]);
  const [allProjects, setAllProjects] = useState(false);
  const [noExpiry, setNoExpiry] = useState(false);

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ url: string; curl: string; mQuery: string } | null>(null);

  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ReportingKey | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [keyRes, projectRes, fieldRes] = await Promise.all([
        apiService.get('/admin/reporting/keys'),
        apiService.get('/projects?limit=500'),
        apiService.get('/admin/reporting/fields'),
      ]);
      setKeys(keyRes.data || []);
      const projectRows = Array.isArray(projectRes.data) ? projectRes.data : [];
      setProjects(projectRows.map((p: { id: number; name: string }) => ({ id: Number(p.id), name: p.name })));
      const fieldRows: FieldMeta[] = fieldRes.data || [];
      setFields(fieldRows);
      setSelectedFields(fieldRows.filter((f) => f.default).map((f) => f.fieldName));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load Reporting API', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await apiService.post('/admin/reporting/preview', {
          projectIds: allProjects ? ['all'] : newProjects,
          fields: selectedFields,
          filters: {},
        });
        setPreview(res.data || null);
      } catch {
        setPreview(null);
      }
    };
    run();
  }, [allProjects, newProjects, selectedFields]);

  const createKey = async () => {
    if (!newName.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (!allProjects && newProjects.length === 0) {
      showToast('Select at least one project', 'error');
      return;
    }
    try {
      setCreating(true);
      const res = await apiService.post('/admin/reporting/keys', {
        name: newName.trim(),
        projectIds: allProjects ? 'all' : newProjects,
        noExpiry,
      });
      setRevealKey(res.data?.apiKey || null);
      setKeyVisible(false);
      setCreateOpen(false);
      setNewName('');
      await load();
      showToast('Reporting API key created', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const rotate = async (id: number) => {
    try {
      const res = await apiService.post(`/admin/reporting/keys/${id}/rotate`, {});
      setRevealKey(res.data?.apiKey || null);
      setKeyVisible(false);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Rotate failed', 'error');
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await apiService.delete(`/admin/reporting/keys/${revokeTarget.id}`);
      setRevokeTarget(null);
      await load();
      showToast('Key revoked', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Revoke failed', 'error');
    }
  };

  const saveConfig = async () => {
    try {
      await apiService.post('/admin/reporting/configs', {
        name: `Config ${new Date().toISOString().slice(0, 10)}`,
        projectIds: allProjects ? ['all'] : newProjects,
        fields: selectedFields,
        filters: {},
      });
      showToast('Configuration saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Save failed', 'error');
    }
  };

  const groups = Array.from(new Set(fields.map((f) => f.group)));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Key className="w-5 h-5" /> Reporting API (Power BI)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Uncapped, streamed read-only extracts. Requires <code>REPORTING_API_ENABLED=true</code>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New key
        </Button>
      </div>

      <Card>
        <CardContent>
          <h3 className="font-medium text-gray-900 mb-3">Field picker &amp; preview</h3>
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allProjects} onChange={(e) => setAllProjects(e.target.checked)} />
              All projects in key scope
            </label>
            {!allProjects && (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <label key={p.id} className="text-xs border rounded px-2 py-1 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={newProjects.includes(p.id)}
                      onChange={(e) => {
                        setNewProjects((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        );
                      }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-h-64 overflow-auto border rounded p-3 mb-4">
            {groups.map((group) => (
              <div key={group}>
                <div className="text-xs font-semibold uppercase text-gray-500 mb-1">{group}</div>
                {fields.filter((f) => f.group === group).map((f) => (
                  <label key={f.fieldName} className="flex items-center gap-2 text-sm py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f.fieldName)}
                      onChange={(e) => {
                        setSelectedFields((prev) =>
                          e.target.checked
                            ? [...prev, f.fieldName]
                            : prev.filter((name) => name !== f.fieldName)
                        );
                      }}
                    />
                    <span>{f.displayName}</span>
                    {f.sensitive && <Badge variant="warning">sensitive</Badge>}
                  </label>
                ))}
              </div>
            ))}
          </div>
          {preview && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500 flex items-center">URL <CopyButton text={preview.url} /></div>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">{preview.url}</pre>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 flex items-center">curl <CopyButton text={preview.curl} /></div>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">{preview.curl}</pre>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 flex items-center">Power BI M <CopyButton text={preview.mQuery} /></div>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48">{preview.mQuery}</pre>
              </div>
              <Button variant="secondary" onClick={saveConfig}>Save configuration</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Keys</h3>
            <button type="button" onClick={load} className="text-gray-500 hover:text-gray-700">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-gray-500">No reporting keys yet.</p>
          ) : (
            <ul className="divide-y">
              {keys.map((key) => (
                <li key={key.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{key.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{key.keyPrefix}…</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Projects: {key.allProjects || key.projectIds?.[0] === 'all' ? 'all' : (key.projectIds || []).join(', ')}
                    </div>
                    {key.revokedAt && <Badge variant="danger">revoked</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => rotate(key.id)} disabled={!!key.revokedAt}>
                      <RotateCw className="w-4 h-4" />
                    </Button>
                    <Button variant="secondary" onClick={() => setRevokeTarget(key)} disabled={!!key.revokedAt}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create reporting API key">
        <div className="space-y-3">
          <label className="block text-sm">
            Name
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allProjects} onChange={(e) => setAllProjects(e.target.checked)} />
            Allow all projects
          </label>
          {!allProjects && (
            <div className="max-h-40 overflow-auto border rounded p-2 space-y-1">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newProjects.includes(p.id)}
                    onChange={(e) => {
                      setNewProjects((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                      );
                    }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} />
            No expiry
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createKey} disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!revealKey} onClose={() => setRevealKey(null)} title="Copy API key now">
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-amber-800 bg-amber-50 p-3 rounded text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            This key is shown once. Store it in Power BI parameters as YOUR_API_KEY replacement.
          </div>
          <div className="flex items-center font-mono text-sm bg-gray-100 p-2 rounded break-all">
            {keyVisible ? revealKey : '••••••••••••••••••••'}
            <button type="button" className="ml-2" onClick={() => setKeyVisible((v) => !v)}>
              {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {revealKey && <CopyButton text={revealKey} />}
          </div>
          <Button onClick={() => setRevealKey(null)}>Done</Button>
        </div>
      </Modal>

      <Modal isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke key?">
        <p className="text-sm text-gray-600 mb-4">
          Revoke <strong>{revokeTarget?.name}</strong>? Scheduled refreshes using this key will fail.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button onClick={revoke}>Revoke</Button>
        </div>
      </Modal>
    </div>
  );
}
