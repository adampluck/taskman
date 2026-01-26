const TaskStorage = (function() {
    const STORAGE_KEY = 'task-manager-tasks';

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function getTasks() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            const tasks = JSON.parse(data);
            return tasks.filter(function(t) {
                return !t._deletedAt;
            });
        } catch (e) {
            console.error('Error parsing tasks:', e);
            return [];
        }
    }

    function getAllTasks() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }

    function saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    function saveTask(taskData) {
        const tasks = getAllTasks();
        const now = new Date().toISOString();
        const isAuth = typeof Auth !== 'undefined' && Auth.isAuthenticated();

        const newTask = {
            id: generateId(),
            title: taskData.title,
            category: taskData.category || 'other',
            timeEstimate: taskData.timeEstimate || 30,
            completed: false,
            createdAt: now,
            completedAt: null,
            _updatedAt: now,
            _syncStatus: isAuth ? 'pending' : null,
            _remoteId: null,
            _deletedAt: null
        };

        tasks.unshift(newTask);
        saveTasks(tasks);

        if (isAuth && typeof SyncEngine !== 'undefined') {
            SyncEngine.queueChange('create', newTask);
        }

        return newTask;
    }

    function updateTask(id, updates) {
        const tasks = getAllTasks();
        const index = tasks.findIndex(function(t) {
            return t.id === id;
        });
        if (index === -1) return null;

        const now = new Date().toISOString();
        const isAuth = typeof Auth !== 'undefined' && Auth.isAuthenticated();

        const syncUpdates = {
            _updatedAt: now
        };

        if (isAuth && updates._syncStatus === undefined) {
            syncUpdates._syncStatus = 'pending';
        }

        tasks[index] = Object.assign({}, tasks[index], updates, syncUpdates);
        saveTasks(tasks);

        if (isAuth && typeof SyncEngine !== 'undefined' && updates._syncStatus !== 'synced') {
            SyncEngine.queueChange('update', tasks[index]);
        }

        return tasks[index];
    }

    function updateTaskSyncMeta(id, meta) {
        const tasks = getAllTasks();
        const index = tasks.findIndex(function(t) {
            return t.id === id;
        });
        if (index === -1) return null;

        tasks[index] = Object.assign({}, tasks[index], meta);
        saveTasks(tasks);
        return tasks[index];
    }

    function deleteTask(id) {
        const tasks = getAllTasks();
        const task = tasks.find(function(t) {
            return t.id === id;
        });
        if (!task) return false;

        const isAuth = typeof Auth !== 'undefined' && Auth.isAuthenticated();

        if (isAuth && task._remoteId) {
            task._deletedAt = new Date().toISOString();
            task._syncStatus = 'pending';
            saveTasks(tasks);

            if (typeof SyncEngine !== 'undefined') {
                SyncEngine.queueChange('delete', task);
            }
        } else {
            const filtered = tasks.filter(function(t) {
                return t.id !== id;
            });
            saveTasks(filtered);
        }

        return true;
    }

    function hardDelete(id) {
        const tasks = getAllTasks();
        const filtered = tasks.filter(function(t) {
            return t.id !== id;
        });
        saveTasks(filtered);
        return true;
    }

    function toggleComplete(id) {
        const tasks = getAllTasks();
        const task = tasks.find(function(t) {
            return t.id === id;
        });
        if (!task) return null;

        const now = new Date().toISOString();
        const isAuth = typeof Auth !== 'undefined' && Auth.isAuthenticated();

        task.completed = !task.completed;
        task.completedAt = task.completed ? now : null;
        task._updatedAt = now;

        if (isAuth) {
            task._syncStatus = 'pending';
        }

        saveTasks(tasks);

        if (isAuth && typeof SyncEngine !== 'undefined') {
            SyncEngine.queueChange('update', task);
        }

        return task;
    }

    function insertFromRemote(taskData) {
        const tasks = getAllTasks();

        const existing = tasks.find(function(t) {
            return t.id === taskData.id || t._remoteId === taskData._remoteId;
        });

        if (existing) {
            return updateTask(existing.id, taskData);
        }

        tasks.unshift(taskData);
        saveTasks(tasks);
        return taskData;
    }

    function getUnsyncedTasks() {
        return getAllTasks().filter(function(t) {
            return !t._remoteId && !t._deletedAt;
        });
    }

    function clearSyncData() {
        const tasks = getAllTasks();
        tasks.forEach(function(t) {
            t._syncStatus = null;
            t._remoteId = null;
            t._deletedAt = null;
        });
        const filtered = tasks.filter(function(t) {
            return !t._deletedAt;
        });
        saveTasks(filtered);
    }

    return {
        getTasks: getTasks,
        getAllTasks: getAllTasks,
        saveTask: saveTask,
        updateTask: updateTask,
        updateTaskSyncMeta: updateTaskSyncMeta,
        deleteTask: deleteTask,
        hardDelete: hardDelete,
        toggleComplete: toggleComplete,
        insertFromRemote: insertFromRemote,
        getUnsyncedTasks: getUnsyncedTasks,
        clearSyncData: clearSyncData
    };
})();
