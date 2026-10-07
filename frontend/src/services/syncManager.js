/**
 * Reusable Sync Manager for MPLADS Offline-First Field Verification
 * Responsibilities:
 *  1. Monitor network connectivity (navigator.onLine + active /health ping confirmation)
 *  2. Listen for 'online' event to automatically trigger background sync
 *  3. In-flight operation lock to prevent parallel duplicate execution
 *  4. Submit pending queue items to backend idempotently using operation_id
 *  5. Detect and isolate version conflicts (HTTP 409) without silent data loss
 *  6. Retain and retry failed operations with error tracking
 *  7. Notify subscribed UI listeners reactively of sync progress
 */

import { getAllQueueItems, updateQueueItem, updateCachedProject, saveLocalVerificationRecord } from './db';
import { submitFieldVerification } from '../api/client';

class SyncManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.isSyncing = false;
    this.subscribers = new Set();
    this.lastSyncTime = null;
    this.queueSummary = {
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      conflict: 0
    };
    this.statusMessage = 'System ready';

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      // Refresh summary on startup
      this.refreshQueueSummary();
      // Verify initial engine health
      this.checkEngineHealth();
      setInterval(() => this.checkEngineHealth(), 15000);
    }
  }

  async checkEngineHealth() {
    const healthy = await this.pingHealth();
    if (this.isOnline !== healthy) {
      this.isOnline = healthy;
      this.statusMessage = healthy ? 'Engine online' : 'Analytical engine offline (port 8001)';
      this.notify();
    }
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    // Send immediate initial state
    listener(this.getState());
    return () => this.subscribers.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in sync subscriber:', err);
      }
    });
  }

  getState() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      queueSummary: { ...this.queueSummary },
      statusMessage: this.statusMessage
    };
  }

  async handleNetworkChange(onlineState) {
    this.isOnline = onlineState;
    if (onlineState) {
      this.statusMessage = 'Connection restored. Checking sync queue...';
      this.notify();
      // Confirm genuine connectivity before triggering sync
      const healthy = await this.pingHealth();
      if (healthy) {
        this.triggerSync();
      }
    } else {
      this.statusMessage = 'Offline. Changes will be saved locally.';
      this.notify();
    }
  }

  async pingHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/v1/health', { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshQueueSummary() {
    try {
      const items = await getAllQueueItems();
      const counts = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };
      items.forEach((item) => {
        if (counts[item.status] !== undefined) {
          counts[item.status]++;
        } else {
          counts.pending++;
        }
      });
      this.queueSummary = counts;
      this.notify();
      return counts;
    } catch (err) {
      console.warn('Could not refresh queue summary:', err);
      return this.queueSummary;
    }
  }

  async triggerSync() {
    if (this.isSyncing) return;

    // Check genuine online reachability
    const isReachable = await this.pingHealth();
    if (!isReachable) {
      this.isOnline = false;
      this.statusMessage = 'Server unreachable. Verification queued locally.';
      this.notify();
      return;
    }
    this.isOnline = true;

    try {
      const allItems = await getAllQueueItems();
      // Items that require synchronization (pending or previously failed)
      const toSync = allItems.filter(
        (item) => item.status === 'pending' || item.status === 'failed'
      );

      if (toSync.length === 0) {
        await this.refreshQueueSummary();
        return;
      }

      this.isSyncing = true;
      this.statusMessage = `Syncing ${toSync.length} change${toSync.length > 1 ? 's' : ''}...`;
      this.notify();

      let successCount = 0;
      let failCount = 0;
      let conflictCount = 0;

      for (const item of toSync) {
        try {
          await updateQueueItem(item.operation_id, { status: 'syncing' });
          this.notify();

          // Prepare payload for API
          const verificationPayload = {
            operation_id: item.operation_id,
            user_id: item.user_id,
            device_id: item.device_id,
            progress: Number(item.payload.progress),
            verification_status: item.payload.verification_status,
            remarks: item.payload.remarks || '',
            latitude: item.payload.latitude ?? null,
            longitude: item.payload.longitude ?? null,
            verified_at: item.payload.verified_at,
            evidence_photo: item.payload.evidence_photo || null,
            expected_version: item.payload.expected_version
          };

          const result = await submitFieldVerification(item.project_id, verificationPayload);

          if (result && result.success) {
            await updateQueueItem(item.operation_id, {
              status: 'synced',
              last_error: null
            });

            // Update local cached project with new progress and new version
            await updateCachedProject(item.project_id, {
              physical_progress: item.payload.progress,
              version: result.version,
              overall_risk_score: result.risk_update?.current_risk_score,
              risk_level: result.risk_update?.current_risk_level
            });

            // Update local verification record status
            await saveLocalVerificationRecord({
              operation_id: item.operation_id,
              project_id: item.project_id,
              progress: item.payload.progress,
              verification_status: item.payload.verification_status,
              remarks: item.payload.remarks,
              latitude: item.payload.latitude,
              longitude: item.payload.longitude,
              verified_at: item.payload.verified_at,
              sync_status: 'synced',
              created_at: item.created_at,
              verification_id: result.verification_id
            });

            successCount++;
          } else {
            throw new Error(result?.message || 'Verification rejected by server');
          }
        } catch (err) {
          if (err.status === 409 || err.message?.includes('Conflict')) {
            // Optimistic concurrency conflict
            conflictCount++;
            await updateQueueItem(item.operation_id, {
              status: 'conflict',
              last_error: err.message || 'Project was modified on server'
            });
          } else {
            // Network failure or server error
            failCount++;
            await updateQueueItem(item.operation_id, {
              status: 'failed',
              retry_count: (item.retry_count || 0) + 1,
              last_error: err.message || 'Network sync failed'
            });
          }
        }
      }

      this.lastSyncTime = new Date();
      await this.refreshQueueSummary();

      if (conflictCount > 0) {
        this.statusMessage = `${conflictCount} conflict detected. Review server updates.`;
      } else if (failCount > 0) {
        this.statusMessage = `${successCount} synced, ${failCount} failed (will retry).`;
      } else {
        this.statusMessage = 'All changes synced successfully ✓';
      }

      // Notify application of synced data to trigger UI and KPI updates
      if (successCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mplads:data_synced', { detail: { count: successCount } }));
      }
    } catch (err) {
      console.error('Fatal sync cycle error:', err);
      this.statusMessage = 'Sync encountered an error';
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const syncManager = new SyncManager();
export default syncManager;
