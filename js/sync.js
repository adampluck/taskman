const SyncEngine = (function() {
    let syncTimer = null;
    let isSyncing = false;
    let statusListeners = [];

    function init() {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (navigator.onLine && Auth.isAuthenticated()) {
            scheduleSync();
        }
    }

    function getQueue() {
        const data = localStorage.getItem(Config.STORAGE_KEYS.SYNC_QUEUE);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }

    function saveQueue(queue) {
        localStorage.setItem(Config.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    }

    function queueChange(action, task) {
        if (!Auth.isAuthenticated()) return;

        const queue = getQueue();
        const filtered = queue.filter(function(q) {
            return q.taskId !== task.id;
        });

        filtered.push({
            action: action,
            taskId: task.id,
            timestamp: new Date().toISOString(),
            retries: 0
        });

        saveQueue(filtered);
        scheduleSync();
    }

    function removeFromQueue(taskId) {
        const queue = getQueue();
        const filtered = queue.filter(function(q) {
            return q.taskId !== taskId;
        });
        saveQueue(filtered);
    }

    function scheduleSync() {
        if (syncTimer) clearTimeout(syncTimer);

        syncTimer = setTimeout(function() {
            processQueue();
        }, Config.SYNC_DEBOUNCE_MS);
    }

    async function processQueue() {
        if (isSyncing || !navigator.onLine || !Auth.isAuthenticated()) {
            return;
        }

        const client = getSupabase();
        if (!client) return;

        isSyncing = true;
        notifyStatus('syncing');

        try {
            const queue = getQueue();

            if (queue.length === 0) {
                await pullRemoteChanges();
                notifyStatus('synced');
                isSyncing = false;
                return;
            }

            const tasks = TaskStorage.getTasks();

            for (let i = 0; i < queue.length; i++) {
                const item = queue[i];
                const task = tasks.find(function(t) {
                    return t.id === item.taskId;
                });

                if (!task && item.action !== 'delete') continue;

                try {
                    if (item.action === 'delete') {
                        const taskToDelete = task || { id: item.taskId, _remoteId: item.remoteId };
                        const hadRemoteId = !!taskToDelete._remoteId;
                        await deleteRemote(taskToDelete);
                        if (hadRemoteId) {
                            Payments.decrementTaskCount();
                        }
                    } else {
                        // Check task limit for new tasks (no _remoteId yet)
                        const isNewTask = !task._remoteId;
                        if (isNewTask && !Payments.canSyncMoreTasks()) {
                            notifyStatus('limit_reached');
                            removeFromQueue(item.taskId);
                            continue;
                        }
                        await upsertRemote(task);
                        if (isNewTask) {
                            Payments.incrementTaskCount();
                        }
                    }
                    removeFromQueue(item.taskId);
                } catch (error) {
                    console.error('Sync error for task:', item.taskId, error);
                    item.retries++;
                    if (item.retries >= Config.MAX_SYNC_RETRIES) {
                        removeFromQueue(item.taskId);
                    }
                }
            }

            await pullRemoteChanges();
            notifyStatus('synced');
        } catch (error) {
            console.error('Sync failed:', error);
            notifyStatus('error');
        } finally {
            isSyncing = false;
        }
    }

    async function upsertRemote(task) {
        const client = getSupabase();
        if (!client) return;

        const user = Auth.getUser();
        if (!user) return;

        const payload = {
            user_id: user.id,
            local_id: task.id,
            title: task.title,
            category: task.category,
            time_estimate: task.timeEstimate,
            completed: task.completed,
            created_at: task.createdAt,
            completed_at: task.completedAt || null,
            updated_at: task._updatedAt || new Date().toISOString()
        };

        if (task._remoteId) {
            payload.id = task._remoteId;
        }

        const { data, error } = await client
            .from('tasks')
            .upsert(payload, { onConflict: 'user_id,local_id' })
            .select()
            .single();

        if (error) throw error;

        TaskStorage.updateTaskSyncMeta(task.id, {
            _remoteId: data.id,
            _syncStatus: 'synced'
        });
    }

    async function deleteRemote(task) {
        if (!task._remoteId) {
            TaskStorage.hardDelete(task.id);
            return;
        }

        const client = getSupabase();
        if (!client) return;

        const { error } = await client
            .from('tasks')
            .delete()
            .eq('id', task._remoteId);

        if (error) throw error;

        TaskStorage.hardDelete(task.id);
    }

    async function pullRemoteChanges() {
        const client = getSupabase();
        if (!client) return;

        const lastSync = localStorage.getItem(Config.STORAGE_KEYS.LAST_SYNC) || '1970-01-01T00:00:00Z';

        const { data, error } = await client
            .from('tasks')
            .select('*')
            .gte('updated_at', lastSync);

        if (error) throw error;

        if (data && data.length > 0) {
            applyRemoteChanges(data);
        }

        localStorage.setItem(Config.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    }

    function applyRemoteChanges(remoteTasks) {
        const localTasks = TaskStorage.getTasks();
        const localMap = {};

        localTasks.forEach(function(t) {
            localMap[t.id] = t;
            if (t._remoteId) {
                localMap[t._remoteId] = t;
            }
        });

        remoteTasks.forEach(function(remote) {
            const localByRemoteId = localMap[remote.id];
            const localByLocalId = localMap[remote.local_id];
            const local = localByRemoteId || localByLocalId;

            if (remote.deleted_at) {
                if (local) {
                    TaskStorage.hardDelete(local.id);
                }
                return;
            }

            if (local) {
                const localTime = new Date(local._updatedAt || local.createdAt);
                const remoteTime = new Date(remote.updated_at);

                if (remoteTime > localTime) {
                    TaskStorage.updateTask(local.id, {
                        title: remote.title,
                        category: remote.category,
                        timeEstimate: remote.time_estimate,
                        completed: remote.completed,
                        completedAt: remote.completed_at,
                        _remoteId: remote.id,
                        _updatedAt: remote.updated_at,
                        _syncStatus: 'synced'
                    });
                }
            } else {
                TaskStorage.insertFromRemote({
                    id: remote.local_id,
                    title: remote.title,
                    category: remote.category,
                    timeEstimate: remote.time_estimate,
                    completed: remote.completed,
                    createdAt: remote.created_at,
                    completedAt: remote.completed_at,
                    _remoteId: remote.id,
                    _updatedAt: remote.updated_at,
                    _syncStatus: 'synced'
                });
            }
        });
    }

    async function migrateGuestData() {
        const tasks = TaskStorage.getTasks();
        const guestTasks = tasks.filter(function(t) {
            return !t._remoteId;
        });

        if (guestTasks.length === 0) return { migrated: 0, total: 0, limitReached: false };

        let migrated = 0;
        let limitReached = false;
        for (let i = 0; i < guestTasks.length; i++) {
            // Check task limit before migrating each task
            if (!Payments.canSyncMoreTasks()) {
                limitReached = true;
                notifyStatus('limit_reached');
                break;
            }
            try {
                await upsertRemote(guestTasks[i]);
                Payments.incrementTaskCount();
                migrated++;
            } catch (error) {
                console.error('Failed to migrate task:', guestTasks[i].id, error);
            }
        }

        return { migrated: migrated, total: guestTasks.length, limitReached: limitReached };
    }

    async function fullSync() {
        const client = getSupabase();
        if (!client || !Auth.isAuthenticated()) return;

        notifyStatus('syncing');

        try {
            const { data, error } = await client
                .from('tasks')
                .select('*');

            if (error) throw error;

            if (data) {
                applyRemoteChanges(data);
            }

            localStorage.setItem(Config.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
            notifyStatus('synced');
        } catch (error) {
            console.error('Full sync failed:', error);
            notifyStatus('error');
        }
    }

    function handleOnline() {
        if (Auth.isAuthenticated()) {
            scheduleSync();
        }
        notifyStatus('online');
    }

    function handleOffline() {
        notifyStatus('offline');
    }

    function onStatusChange(callback) {
        statusListeners.push(callback);
        return function() {
            statusListeners = statusListeners.filter(function(cb) {
                return cb !== callback;
            });
        };
    }

    function notifyStatus(status) {
        statusListeners.forEach(function(cb) {
            cb(status);
        });
    }

    function getPendingCount() {
        return getQueue().length;
    }

    return {
        init: init,
        queueChange: queueChange,
        processQueue: processQueue,
        migrateGuestData: migrateGuestData,
        fullSync: fullSync,
        onStatusChange: onStatusChange,
        getPendingCount: getPendingCount
    };
})();
