import React, { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Dashboard } from './Dashboard';
import { ProjectManager } from './ProjectManager';
import { TeamManager } from './TeamManager';
import { TaskManager } from './TaskManager';
import { DailyAllocations } from './DailyAllocations';
import { Settings } from './Settings';
import { Analytics } from './Analytics';
import { CoreAnalytics } from './CoreAnalytics';
import { Notification } from './Notification';
import { TopPerformers } from './TopPerformers';
import { ToastProvider } from './ui/Toast';
import { TaskDetails } from './TaskDetails';
import { requestTasksListRefresh } from '../utils/taskManagerCache';

export function MainApp() {
  const { state, dispatch } = useApp();

  // Track whether we pushed our sentinel entry into browser history.
  // We do this exactly once on mount so the browser always has one real
  // entry to go "back" to inside the app before hitting the pre-app page.
  const sentinelPushed = useRef(false);

  useEffect(() => {
    if (!sentinelPushed.current) {
      // Replace the current entry so the URL looks clean, then push one
      // sentinel entry on top. Now the browser history looks like:
      //   [pre-app page] → [app-sentinel]   ← user is here
      // When the user hits back, popstate fires and we handle it internally.
      // We never go further back than the sentinel while the app is mounted.
      window.history.replaceState({ appView: state.selectedView, isApp: true }, '');
      window.history.pushState({ appView: state.selectedView, isApp: true }, '');
      sentinelPushed.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // Whenever the app view changes (via sidebar clicks etc.), update the
  // sentinel entry URL-less state so the browser title stays correct,
  // but do NOT push a new browser history entry — the app manages its
  // own stack in AppContext.viewHistory.
  useEffect(() => {
    if (sentinelPushed.current) {
      window.history.replaceState({ appView: state.selectedView, isApp: true }, '');
    }
  }, [state.selectedView, state.selectedTaskId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If the state we popped to is still inside the app, handle it ourselves
      // and immediately re-push the sentinel so the back button keeps working.
      const canGoBack =
        state.viewHistory.length > 1 ||
        state.selectedTaskId !== null;

      if (canGoBack) {
        // Intercept: re-push sentinel so we stay at the same browser depth
        window.history.pushState({ appView: state.selectedView, isApp: true }, '');

        if (state.selectedTaskId) {
          const fromTasks =
            state.selectedView === 'tasks' || state.previousView === 'tasks';
          // In task detail view → go back to the page that opened the task
          dispatch({ type: 'SET_SELECTED_TASK', payload: null });
          dispatch({ type: 'SET_SELECTED_VIEW', payload: state.previousView });
          if (fromTasks) {
            requestTasksListRefresh();
          }
        } else {
          // In a normal page → pop from the app's own history stack
          dispatch({ type: 'POP_VIEW' });
        }
      }
      // If canGoBack is false we're at the root of the app stack.
      // Let the browser do its natural thing (navigate away / close tab).
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.viewHistory, state.selectedTaskId, state.previousView, dispatch, state.selectedView]);

  const handleTaskDetailBack = useCallback(() => {
    const fromTasks =
      state.selectedView === 'tasks' || state.previousView === 'tasks';
    dispatch({ type: 'SET_SELECTED_TASK', payload: null });
    if (state.previousView !== state.selectedView) {
      dispatch({ type: 'SET_SELECTED_VIEW', payload: state.previousView });
    }
    if (fromTasks) {
      requestTasksListRefresh();
    }
  }, [dispatch, state.previousView, state.selectedView]);

  const showTaskDetail = !!state.selectedTaskId;
  // Keep TaskManager mounted (hidden) while viewing a task opened from Tasks
  // so back navigation does not remount and refetch ~12 APIs.
  const keepTasksListAlive =
    state.selectedView === 'tasks' ||
    (showTaskDetail && state.previousView === 'tasks');

  const renderOtherView = () => {
    switch (state.selectedView) {
      case 'projects':
        return <ProjectManager />;
      case 'teams':
        return <TeamManager />;
      case 'allocations':
        return (
          <DailyAllocations
            onNavigateToTask={(taskId) => {
              dispatch({ type: 'SET_PREVIOUS_VIEW', payload: state.selectedView });
              dispatch({ type: 'SET_SELECTED_TASK', payload: taskId.toString() });
              dispatch({ type: 'SET_SELECTED_VIEW', payload: 'task-details' as any });
            }}
          />
        );
      case 'analytics':
        return <Analytics />;
      case 'core-analytics':
        return <CoreAnalytics />;
      case 'notifications':
        return <Notification />;
      case 'top-performers':
        return <TopPerformers />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const renderContent = () => {
    if (keepTasksListAlive) {
      return (
        <>
          <div className={showTaskDetail ? 'hidden' : undefined} aria-hidden={showTaskDetail}>
            <TaskManager />
          </div>
          {showTaskDetail && state.selectedTaskId && (
            <TaskDetails taskId={state.selectedTaskId} onBack={handleTaskDetailBack} />
          )}
        </>
      );
    }

    if (showTaskDetail && state.selectedTaskId) {
      return (
        <TaskDetails taskId={state.selectedTaskId} onBack={handleTaskDetailBack} />
      );
    }

    if (state.selectedView === 'tasks') {
      return <TaskManager />;
    }

    return renderOtherView();
  };

  return (
    <ToastProvider>
      <div className="h-screen bg-gray-50 flex overflow-hidden" style={{ maxHeight: '100vh' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
            {renderContent()}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
