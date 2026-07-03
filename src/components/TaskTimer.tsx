import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, CheckCircle, RotateCcw, Clock } from 'lucide-react';
import { taskService, teamTaskService } from '../services/apiService';
import { useToast } from './ui/Toast';

interface TaskTimerProps {
  taskId: string | number;
  taskStatus?: string;
  isTeamMember?: boolean;
  onTimerAction?: () => void;
  compact?: boolean;
}

interface TimerState {
  timer_status: 'not_started' | 'in_progress' | 'paused' | 'completed';
  is_running: boolean;
  /** Committed seconds (sum of all finished sessions, NOT including current running session) */
  committed_seconds: number;
  /** Seconds elapsed in the current running session at the moment of fetch */
  live_seconds: number;
  total_time_formatted: string;
}

const formatSeconds = (seconds: number): string => {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
};

// Shared button style for compact mode — all equal height/padding
const BTN = 'inline-flex items-center justify-center gap-1 h-7 px-3 text-xs font-medium rounded-md transition-colors disabled:opacity-50 whitespace-nowrap';

export function TaskTimer({
  taskId,
  taskStatus,
  isTeamMember = false,
  onTimerAction,
  compact = false,
}: TaskTimerProps) {
  const { showToast } = useToast();
  const service = isTeamMember ? teamTaskService : taskService;

  // sessionStorage key for persisting timer start anchor across page refreshes
  const SESSION_KEY = `timer_start_${taskId}`;

  const [timerState, setTimerState] = useState<TimerState>(() => {
    // Restore from sessionStorage on mount so the display is instant after refresh
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { committedSeconds, startedAt } = JSON.parse(raw);
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        return {
          timer_status: 'in_progress',
          is_running: true,
          committed_seconds: committedSeconds,
          live_seconds: elapsed,
          total_time_formatted: '',
        };
      }
    } catch { /* ignore */ }
    return {
      timer_status: 'not_started',
      is_running: false,
      committed_seconds: 0,
      live_seconds: 0,
      total_time_formatted: '0s',
    };
  });
  const [loading, setLoading] = useState(false);
  // Seconds elapsed in the current session, ticking live
  const [sessionElapsed, setSessionElapsed] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { startedAt } = JSON.parse(raw);
        return Math.floor((Date.now() - startedAt) / 1000);
      }
    } catch { /* ignore */ }
    return 0;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Whether the interval is currently active (tracked separately to avoid stale closure)
  const isRunningRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    // Guard: skip fetch if taskId is invalid (0, null, undefined, empty string)
    if (!taskId || taskId === 0 || taskId === '0') return;
    try {
      const data = await service.getTimerStatus(taskId);

      const live = data.live_seconds ?? 0;
      const total = data.total_time_seconds ?? 0;
      const committed = Math.max(0, total - live);
      const running = !!data.is_running;

      setTimerState({
        timer_status: data.timer_status ?? 'not_started',
        is_running: running,
        committed_seconds: committed,
        live_seconds: live,
        total_time_formatted: data.total_time_formatted ?? '0s',
      });

      // Sync session elapsed with server value
      setSessionElapsed(running ? live : 0);
      isRunningRef.current = running;

      // Keep sessionStorage in sync with server truth
      if (running) {
        const startedAt = Date.now() - live * 1000;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ committedSeconds: committed, startedAt }));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // silently ignore
    }
  }, [taskId, service, SESSION_KEY]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Tick every second while running
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timerState.is_running) {
      isRunningRef.current = true;
      intervalRef.current = setInterval(() => {
        setSessionElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      isRunningRef.current = false;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState.is_running]);

  // Poll server every 30 seconds while running to stay in sync
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (timerState.is_running) {
      pollRef.current = setInterval(() => {
        fetchStatus();
      }, 30_000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [timerState.is_running, fetchStatus]);

  // Total to display = committed past sessions + current session tick
  const displaySeconds = timerState.is_running
    ? timerState.committed_seconds + sessionElapsed
    : timerState.committed_seconds;

  const displayTime = formatSeconds(displaySeconds);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await service.startTimer(taskId);
      await fetchStatus();
      showToast('Timer started', 'success');
      onTimerAction?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to start timer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await service.pauseTimer(taskId);
      await fetchStatus();
      showToast('Timer paused', 'success');
      onTimerAction?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to pause timer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await service.resumeTimer(taskId);
      await fetchStatus();
      showToast('Timer resumed', 'success');
      onTimerAction?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to resume timer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await service.completeTimer(taskId);
      await fetchStatus();
      showToast('Timer completed', 'success');
      onTimerAction?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete timer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted =
    timerState.timer_status === 'completed' || taskStatus === 'completed';
  const isOnHold = taskStatus === 'on-hold';
  const isTimerDisabled = isCompleted || isOnHold;

  // ── Compact mode (task cards) ──────────────────────────────────────────────
  if (compact) {
    // Admin view: show only the actual time taken, no action buttons
    if (!isTeamMember) {
      return (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="w-3.5 h-3.5" />
              {displaySeconds > 0 ? displayTime : 'Done'}
            </span>
          ) : displaySeconds > 0 || timerState.is_running ? (
            <span
              className={`inline-flex items-center gap-1 h-7 px-2 text-xs font-mono font-medium rounded-md border ${
                timerState.is_running
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              {displayTime}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      );
    }

    // Team member view: full timer controls
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Timer display — same height as buttons */}
        {(displaySeconds > 0 || timerState.is_running) && !isCompleted && (
          <span
            className={`inline-flex items-center gap-1 h-7 px-2 text-xs font-mono font-medium rounded-md border ${
              timerState.is_running
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <Clock className="w-3 h-3 shrink-0" />
            {displayTime}
          </span>
        )}

        {isOnHold ? (
          <span className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md">
            On Hold
          </span>
        ) : isCompleted ? (
          <span className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="w-3.5 h-3.5" />
            {displaySeconds > 0 ? displayTime : 'Done'}
          </span>
        ) : timerState.is_running ? (
          <>
            <button onClick={handlePause} disabled={loading} title="Pause timer"
              className={`${BTN} bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-200`}>
              <Pause className="w-3 h-3" /> Pause
            </button>
            <button onClick={handleComplete} disabled={loading} title="Mark done"
              className={`${BTN} bg-green-100 hover:bg-green-200 text-green-700 border border-green-200`}>
              <CheckCircle className="w-3 h-3" /> Done
            </button>
          </>
        ) : timerState.timer_status === 'paused' ? (
          <>
            <button onClick={handleResume} disabled={loading} title="Resume timer"
              className={`${BTN} bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200`}>
              <RotateCcw className="w-3 h-3" /> Resume
            </button>
            <button onClick={handleComplete} disabled={loading} title="Mark done"
              className={`${BTN} bg-green-100 hover:bg-green-200 text-green-700 border border-green-200`}>
              <CheckCircle className="w-3 h-3" /> Done
            </button>
          </>
        ) : (
          <button onClick={handleStart} disabled={loading} title="Start timer"
            className={`${BTN} bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border border-indigo-200`}>
            <Play className="w-3 h-3" /> Start
          </button>
        )}
      </div>
    );
  }

  // ── Full mode (detail views) ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex items-center gap-2 text-sm font-medium ${
          timerState.is_running ? 'text-green-600' : 'text-gray-700'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span>Time Spent: {displayTime}</span>
        {timerState.is_running && (
          <span className="flex items-center gap-1 text-xs text-green-500 animate-pulse">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            Live
          </span>
        )}
      </div>

      {!isTimerDisabled && isTeamMember && (
        <div className="flex items-center gap-2">
          {timerState.is_running ? (
            <>
              <button onClick={handlePause} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors disabled:opacity-50 font-medium">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
              <button onClick={handleComplete} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors disabled:opacity-50 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Complete
              </button>
            </>
          ) : timerState.timer_status === 'paused' ? (
            <>
              <button onClick={handleResume} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50 font-medium">
                <RotateCcw className="w-3.5 h-3.5" /> Resume
              </button>
              <button onClick={handleComplete} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors disabled:opacity-50 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Complete
              </button>
            </>
          ) : (
            <button onClick={handleStart} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium">
              <Play className="w-3.5 h-3.5" /> Start Timer
            </button>
          )}
        </div>
      )}

      {isOnHold && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Timer unavailable while task is on hold</span>
        </div>
      )}

      {isCompleted && displaySeconds > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Completed in {displayTime}</span>
        </div>
      )}
    </div>
  );
}

// ─── Time Log Modal ────────────────────────────────────────────────────────────
interface TimeLogModalProps {
  taskId: string | number;
  taskName: string;
  assignedDate?: string;
  isTeamMember?: boolean;
  onClose: () => void;
}

export function TimeLogModal({
  taskId,
  taskName,
  assignedDate,
  isTeamMember = false,
  onClose,
}: TimeLogModalProps) {
  const service = isTeamMember ? teamTaskService : taskService;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    service
      .getTimeLog(taskId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Time Log</h3>
            <p className="text-sm text-gray-500 truncate max-w-xs">{taskName}</p>
            {assignedDate && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Assigned: {new Date(assignedDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : !data ? (
            <p className="text-center text-gray-500 py-8">No time data available.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5 p-3 bg-indigo-50 rounded-lg">
                <Clock className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Total Time Spent</p>
                  <p className="text-xl font-bold text-indigo-700">
                    {Math.max(0, data.total_time_seconds || 0) === 0
                      ? '0m'
                      : data.total_time_formatted}
                  </p>
                  <p className="text-xs text-indigo-500">
                    {Math.max(0, data.total_time_hours || 0).toFixed(2)}h
                  </p>
                </div>
              </div>

              {data.sessions?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="pb-2">#</th>
                      <th className="pb-2">Start</th>
                      <th className="pb-2">End</th>
                      <th className="pb-2">Duration</th>
                      <th className="pb-2">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map((s: any, i: number) => {
                      // Guard against old negative-duration rows from timezone bug
                      const durSec = Math.max(0, s.duration_seconds || 0);
                      const durFormatted = s.status === 'running'
                        ? s.duration_formatted
                        : formatSeconds(durSec);
                      return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 text-gray-700">
                          {s.start ? new Date(s.start).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 text-gray-700">
                          {s.status === 'running' ? (
                            <span className="text-green-600 font-medium animate-pulse">
                              Running
                            </span>
                          ) : s.end ? (
                            new Date(s.end).toLocaleString()
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 font-medium text-gray-900">
                          {durFormatted}
                        </td>
                        <td className="py-2 text-gray-500 text-xs">
                          {s.user_name || '—'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-400 py-4">
                  No sessions recorded yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
