const App = (function() {
    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const categorySelect = document.getElementById('category-select');
    const timeSelect = document.getElementById('time-select');
    const voiceBtn = document.getElementById('voice-btn');
    const taskList = document.getElementById('task-list');
    const emptyMessage = document.getElementById('empty-message');
    const filterCategory = document.getElementById('filter-category');
    const voiceStatus = document.getElementById('voice-status');

    let currentFilter = 'all';

    function init() {
        renderTasks();
        bindEvents();
        initSpeech();
        registerServiceWorker();
    }

    function bindEvents() {
        taskForm.addEventListener('submit', handleSubmit);
        voiceBtn.addEventListener('click', handleVoiceClick);
        filterCategory.addEventListener('change', handleFilterChange);
        taskList.addEventListener('click', handleTaskAction);
        taskList.addEventListener('change', handleTaskChange);
    }

    function initSpeech() {
        if (!SpeechInput.isSupported()) {
            voiceBtn.style.display = 'none';
            return;
        }

        SpeechInput.init();

        SpeechInput.onResult(function(transcript) {
            taskInput.value = transcript;
            hideVoiceStatus();
        });

        SpeechInput.onError(function(error) {
            hideVoiceStatus();
            if (error !== 'aborted') {
                alert('Voice input error: ' + error);
            }
        });

        SpeechInput.onEnd(function() {
            voiceBtn.classList.remove('recording');
            hideVoiceStatus();
        });
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(function(registration) {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch(function(error) {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    function handleSubmit(e) {
        e.preventDefault();

        const title = taskInput.value.trim();
        if (!title) return;

        const task = TaskStorage.saveTask({
            title: title,
            category: categorySelect.value,
            timeEstimate: parseInt(timeSelect.value, 10)
        });

        renderTasks();
        taskForm.reset();
        taskInput.focus();
    }

    function handleVoiceClick() {
        if (SpeechInput.getIsListening()) {
            SpeechInput.stopListening();
            voiceBtn.classList.remove('recording');
            hideVoiceStatus();
        } else {
            const started = SpeechInput.startListening();
            if (started) {
                voiceBtn.classList.add('recording');
                showVoiceStatus();
            }
        }
    }

    function handleFilterChange(e) {
        currentFilter = e.target.value;
        renderTasks();
    }

    function handleTaskAction(e) {
        const btn = e.target.closest('.task-action-btn');
        if (!btn) return;

        const card = btn.closest('.task-card');
        const taskId = card.dataset.id;

        if (btn.classList.contains('edit')) {
            startEdit(card, taskId);
        } else if (btn.classList.contains('delete')) {
            deleteTask(taskId);
        }
    }

    function handleTaskChange(e) {
        if (e.target.classList.contains('task-checkbox')) {
            const card = e.target.closest('.task-card');
            const taskId = card.dataset.id;
            TaskStorage.toggleComplete(taskId);
            renderTasks();
        }
    }

    function startEdit(card, taskId) {
        const titleEl = card.querySelector('.task-title');
        const currentTitle = titleEl.textContent;

        card.classList.add('editing');

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'task-edit-input';
        input.value = currentTitle;

        titleEl.parentNode.insertBefore(input, titleEl.nextSibling);
        input.focus();
        input.select();

        function saveEdit() {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                TaskStorage.updateTask(taskId, { title: newTitle });
            }
            renderTasks();
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                renderTasks();
            }
        });
    }

    function deleteTask(taskId) {
        TaskStorage.deleteTask(taskId);
        renderTasks();
    }

    function renderTasks() {
        const tasks = TaskStorage.getTasks();
        const filtered = currentFilter === 'all'
            ? tasks
            : tasks.filter(t => t.category === currentFilter);

        if (filtered.length === 0) {
            taskList.innerHTML = '';
            emptyMessage.classList.remove('hidden');
        } else {
            emptyMessage.classList.add('hidden');
            taskList.innerHTML = filtered.map(renderTaskCard).join('');
        }
    }

    function renderTaskCard(task) {
        const timeLabel = formatTime(task.timeEstimate);
        return `
            <div class="task-card category-${task.category} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-header">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="task-title">${escapeHtml(task.title)}</span>
                    <div class="task-actions">
                        <button class="task-action-btn edit" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="task-action-btn delete" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="task-meta">
                    <span class="task-category category-${task.category}">${task.category}</span>
                    <span class="task-time">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${timeLabel}
                    </span>
                </div>
            </div>
        `;
    }

    function formatTime(minutes) {
        if (minutes < 60) {
            return minutes + ' min';
        } else if (minutes === 60) {
            return '1 hour';
        } else if (minutes < 240) {
            return (minutes / 60) + ' hours';
        } else {
            return '4+ hours';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showVoiceStatus() {
        voiceStatus.classList.remove('hidden');
    }

    function hideVoiceStatus() {
        voiceStatus.classList.add('hidden');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        renderTasks
    };
})();
