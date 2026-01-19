const TaskStorage = (function() {
    const STORAGE_KEY = 'task-manager-tasks';

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function getTasks() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Error parsing tasks:', e);
            return [];
        }
    }

    function saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    function saveTask(taskData) {
        const tasks = getTasks();
        const newTask = {
            id: generateId(),
            title: taskData.title,
            category: taskData.category || 'other',
            timeEstimate: taskData.timeEstimate || 30,
            completed: false,
            createdAt: new Date().toISOString()
        };
        tasks.unshift(newTask);
        saveTasks(tasks);
        return newTask;
    }

    function updateTask(id, updates) {
        const tasks = getTasks();
        const index = tasks.findIndex(t => t.id === id);
        if (index === -1) return null;

        tasks[index] = { ...tasks[index], ...updates };
        saveTasks(tasks);
        return tasks[index];
    }

    function deleteTask(id) {
        const tasks = getTasks();
        const filtered = tasks.filter(t => t.id !== id);
        if (filtered.length === tasks.length) return false;

        saveTasks(filtered);
        return true;
    }

    function toggleComplete(id) {
        const tasks = getTasks();
        const task = tasks.find(t => t.id === id);
        if (!task) return null;

        task.completed = !task.completed;
        saveTasks(tasks);
        return task;
    }

    return {
        getTasks,
        saveTask,
        updateTask,
        deleteTask,
        toggleComplete
    };
})();
