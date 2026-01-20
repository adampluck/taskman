const App = (function() {
    // Views
    const promptView = document.getElementById('prompt-view');
    const taskView = document.getElementById('task-view');
    const emptyView = document.getElementById('empty-view');

    // Prompt elements
    const pickBtn = document.getElementById('pick-btn');
    const pickerCategory = document.getElementById('picker-category');
    const pickerTime = document.getElementById('picker-time');

    // Task elements
    const taskTitle = document.getElementById('task-title');
    const taskMeta = document.getElementById('task-meta');
    const doneBtn = document.getElementById('done-btn');
    const skipBtn = document.getElementById('skip-btn');

    // Add modal elements
    const addToggle = document.getElementById('add-toggle');
    const addModal = document.getElementById('add-modal');
    const closeModal = document.getElementById('close-modal');
    const showAddBtn = document.getElementById('show-add-btn');
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const addCategory = document.getElementById('add-category');
    const addTime = document.getElementById('add-time');

    // Manage modal elements
    const manageToggle = document.getElementById('manage-toggle');
    const manageModal = document.getElementById('manage-modal');
    const closeManage = document.getElementById('close-manage');
    const manageCategoryFilter = document.getElementById('manage-category-filter');
    const manageStatusFilter = document.getElementById('manage-status-filter');
    const manageList = document.getElementById('manage-list');
    const manageEmpty = document.getElementById('manage-empty');

    let currentTask = null;
    let manageCategoryValue = 'all';
    let manageStatusValue = 'all';
    let addFocusArea = 'category'; // For add modal keyboard nav

    // Audio context for UI sounds
    let audioCtx = null;
    function playClick(type) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'scroll') {
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.03;
            oscillator.type = 'sine';
        } else if (type === 'select') {
            oscillator.frequency.value = 1200;
            gainNode.gain.value = 0.05;
            oscillator.type = 'sine';
        } else if (type === 'toggle') {
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.04;
            oscillator.type = 'sine';
        }

        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    }

    function init() {
        bindEvents();
        registerServiceWorker();
    }

    function bindEvents() {
        pickBtn.addEventListener('click', pickTask);
        doneBtn.addEventListener('click', completeTask);
        skipBtn.addEventListener('click', pickTask);
        addToggle.addEventListener('click', openAddModal);
        closeModal.addEventListener('click', closeAddModal);
        showAddBtn.addEventListener('click', openAddModal);
        taskForm.addEventListener('submit', addTask);

        // Category wheel
        const categories = ['work', 'personal', 'shopping', 'health', 'other'];
        const wheelItems = pickerCategory.querySelectorAll('.wheel-item');

        function updateWheel(newIndex) {
            // Wrap around for infinite scroll
            newIndex = ((newIndex % categories.length) + categories.length) % categories.length;
            pickerCategory.dataset.index = newIndex;
            pickerCategory.dataset.value = categories[newIndex];

            // Update offsets and active states
            wheelItems.forEach((item, i) => {
                let offset = i - newIndex;
                // Wrap offset for infinite feel
                if (offset > 2) offset -= categories.length;
                if (offset < -2) offset += categories.length;
                item.dataset.offset = offset;
                item.classList.toggle('active', offset === 0);
            });
        }

        // Click on wheel item
        pickerCategory.addEventListener('click', function(e) {
            const item = e.target.closest('.wheel-item');
            if (!item) return;
            const clickedIndex = categories.indexOf(item.dataset.category);
            if (clickedIndex !== -1) {
                updateWheel(clickedIndex);
                playClick('scroll');
            }
        });

        // Time chip selection
        pickerTime.addEventListener('click', function(e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            pickerTime.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            pickerTime.dataset.value = chip.dataset.value;
            playClick('scroll');
        });

        // Keyboard navigation for main screen
        let focusArea = 'category'; // 'category', 'time', 'button'
        const timeChips = Array.from(pickerTime.querySelectorAll('.time-chip'));

        function updateFocusIndicators() {
            pickerCategory.dataset.focused = focusArea === 'category';
            pickerTime.dataset.focused = focusArea === 'time';
            pickBtn.classList.toggle('focused', focusArea === 'button');
        }

        function getSelectedTimeIndex() {
            return timeChips.findIndex(c => c.classList.contains('selected'));
        }

        function selectTimeChip(index) {
            index = ((index % timeChips.length) + timeChips.length) % timeChips.length;
            timeChips.forEach(c => c.classList.remove('selected'));
            timeChips[index].classList.add('selected');
            pickerTime.dataset.value = timeChips[index].dataset.value;
        }

        // Initialize focus
        updateFocusIndicators();

        // Hover to focus (main screen)
        pickerCategory.addEventListener('mouseenter', function() {
            focusArea = 'category';
            updateFocusIndicators();
        });
        pickerTime.addEventListener('mouseenter', function() {
            focusArea = 'time';
            updateFocusIndicators();
        });
        pickBtn.addEventListener('mouseenter', function() {
            focusArea = 'button';
            updateFocusIndicators();
        });

        document.addEventListener('keydown', function(e) {
            // Only handle when prompt view is visible
            if (promptView.classList.contains('hidden')) return;
            if (addModal && !addModal.classList.contains('hidden')) return;
            if (manageModal && !manageModal.classList.contains('hidden')) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (focusArea === 'time') {
                    focusArea = 'category';
                } else if (focusArea === 'button') {
                    focusArea = 'time';
                }
                updateFocusIndicators();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (focusArea === 'category') {
                    focusArea = 'time';
                } else if (focusArea === 'time') {
                    focusArea = 'button';
                }
                updateFocusIndicators();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (focusArea === 'category') {
                    const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                    updateWheel(currentIndex - 1);
                    playClick('scroll');
                } else if (focusArea === 'time') {
                    const idx = getSelectedTimeIndex();
                    selectTimeChip(idx - 1);
                    playClick('scroll');
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (focusArea === 'category') {
                    const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                    updateWheel(currentIndex + 1);
                    playClick('scroll');
                } else if (focusArea === 'time') {
                    const idx = getSelectedTimeIndex();
                    selectTimeChip(idx + 1);
                    playClick('scroll');
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusArea === 'button') {
                    playClick('select');
                    pickBtn.click();
                }
            }
        });

        // Add modal - category wheel
        const addWheelItems = addCategory.querySelectorAll('.wheel-item');

        function updateAddWheel(newIndex) {
            newIndex = ((newIndex % categories.length) + categories.length) % categories.length;
            addCategory.dataset.index = newIndex;
            addCategory.dataset.value = categories[newIndex];

            addWheelItems.forEach((item, i) => {
                let offset = i - newIndex;
                if (offset > 2) offset -= categories.length;
                if (offset < -2) offset += categories.length;
                item.dataset.offset = offset;
                item.classList.toggle('active', offset === 0);
            });
        }

        addCategory.addEventListener('click', function(e) {
            const item = e.target.closest('.wheel-item');
            if (!item) return;
            const clickedIndex = categories.indexOf(item.dataset.category);
            if (clickedIndex !== -1) {
                updateAddWheel(clickedIndex);
                playClick('scroll');
            }
        });

        // Add modal - time chip selection
        addTime.addEventListener('click', function(e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            addTime.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            addTime.dataset.value = chip.dataset.value;
            playClick('scroll');
        });

        // Add modal keyboard navigation
        const addTimeChips = Array.from(addTime.querySelectorAll('.time-chip'));
        const addBtn = taskForm.querySelector('.btn-add');

        function updateAddFocusIndicators() {
            addCategory.dataset.focused = addFocusArea === 'category';
            taskInput.classList.toggle('focused', addFocusArea === 'input');
            addTime.dataset.focused = addFocusArea === 'time';
            addBtn.classList.toggle('focused', addFocusArea === 'button');
        }

        function getAddSelectedTimeIndex() {
            return addTimeChips.findIndex(c => c.classList.contains('selected'));
        }

        function selectAddTimeChip(index) {
            index = ((index % addTimeChips.length) + addTimeChips.length) % addTimeChips.length;
            addTimeChips.forEach(c => c.classList.remove('selected'));
            addTimeChips[index].classList.add('selected');
            addTime.dataset.value = addTimeChips[index].dataset.value;
        }

        // Hover to focus (add modal)
        addCategory.addEventListener('mouseenter', function() {
            addFocusArea = 'category';
            taskInput.blur();
            updateAddFocusIndicators();
        });
        taskInput.addEventListener('mouseenter', function() {
            addFocusArea = 'input';
            updateAddFocusIndicators();
        });
        taskInput.addEventListener('focus', function() {
            addFocusArea = 'input';
            updateAddFocusIndicators();
        });
        addTime.addEventListener('mouseenter', function() {
            addFocusArea = 'time';
            taskInput.blur();
            updateAddFocusIndicators();
        });
        addBtn.addEventListener('mouseenter', function() {
            addFocusArea = 'button';
            taskInput.blur();
            updateAddFocusIndicators();
        });

        // Manage modal
        manageToggle.addEventListener('click', openManageModal);
        closeManage.addEventListener('click', closeManageModal);

        // Category filter
        manageCategoryFilter.addEventListener('click', function(e) {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            manageCategoryFilter.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            manageCategoryFilter.dataset.value = chip.dataset.value;
            manageCategoryValue = chip.dataset.value;
            renderManageList();
            playClick('scroll');
        });

        // Status filter
        manageStatusFilter.addEventListener('click', function(e) {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            manageStatusFilter.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            manageStatusFilter.dataset.value = chip.dataset.value;
            manageStatusValue = chip.dataset.value;
            renderManageList();
            playClick('scroll');
        });

        manageList.addEventListener('click', handleManageAction);

        // Keyboard handler for modals
        document.addEventListener('keydown', function(e) {
            // Escape closes modals
            if (e.key === 'Escape') {
                if (!addModal.classList.contains('hidden')) closeAddModal();
                if (!manageModal.classList.contains('hidden')) closeManageModal();
                return;
            }

            // Add modal keyboard navigation
            if (!addModal.classList.contains('hidden')) {
                // Don't intercept when typing in input
                if (document.activeElement === taskInput && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                    return;
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (addFocusArea === 'input') {
                        addFocusArea = 'category';
                        taskInput.blur();
                    } else if (addFocusArea === 'time') {
                        addFocusArea = 'input';
                        taskInput.focus();
                    } else if (addFocusArea === 'button') {
                        addFocusArea = 'time';
                    }
                    updateAddFocusIndicators();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (addFocusArea === 'category') {
                        addFocusArea = 'input';
                        taskInput.focus();
                    } else if (addFocusArea === 'input') {
                        addFocusArea = 'time';
                        taskInput.blur();
                    } else if (addFocusArea === 'time') {
                        addFocusArea = 'button';
                    }
                    updateAddFocusIndicators();
                } else if (e.key === 'ArrowLeft') {
                    if (addFocusArea === 'category') {
                        e.preventDefault();
                        const currentIndex = parseInt(addCategory.dataset.index, 10);
                        updateAddWheel(currentIndex - 1);
                        playClick('scroll');
                    } else if (addFocusArea === 'time') {
                        e.preventDefault();
                        const idx = getAddSelectedTimeIndex();
                        selectAddTimeChip(idx - 1);
                        playClick('scroll');
                    }
                } else if (e.key === 'ArrowRight') {
                    if (addFocusArea === 'category') {
                        e.preventDefault();
                        const currentIndex = parseInt(addCategory.dataset.index, 10);
                        updateAddWheel(currentIndex + 1);
                        playClick('scroll');
                    } else if (addFocusArea === 'time') {
                        e.preventDefault();
                        const idx = getAddSelectedTimeIndex();
                        selectAddTimeChip(idx + 1);
                        playClick('scroll');
                    }
                } else if (e.key === 'Enter') {
                    if (addFocusArea === 'button') {
                        playClick('select');
                    }
                    // Let form submit naturally for button or input
                }
                return;
            }

            // Manage modal keyboard navigation
            if (!manageModal.classList.contains('hidden')) {
                // Basic navigation - close on escape handled above
                return;
            }
        });
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(function() {});
        }
    }

    function showView(view) {
        promptView.classList.add('hidden');
        taskView.classList.add('hidden');
        emptyView.classList.add('hidden');
        view.classList.remove('hidden');
    }

    function pickTask() {
        const category = pickerCategory.dataset.value;
        const maxTime = parseInt(pickerTime.dataset.value, 10);

        let tasks = TaskStorage.getTasks().filter(t => !t.completed);

        if (category !== 'all') {
            tasks = tasks.filter(t => t.category === category);
        }

        if (maxTime > 0) {
            tasks = tasks.filter(t => t.timeEstimate <= maxTime);
        }

        if (tasks.length === 0) {
            showView(emptyView);
            return;
        }

        const randomIndex = Math.floor(Math.random() * tasks.length);
        currentTask = tasks[randomIndex];

        taskTitle.textContent = currentTask.title;
        taskMeta.innerHTML = `
            <span>${currentTask.category}</span>
            <span>${formatTime(currentTask.timeEstimate)}</span>
        `;

        showView(taskView);
    }

    function completeTask() {
        if (currentTask) {
            TaskStorage.toggleComplete(currentTask.id);
            currentTask = null;
        }
        showView(promptView);
    }

    // Add Modal
    function openAddModal() {
        addModal.classList.remove('hidden');
        // Reset focus to category
        addFocusArea = 'category';
        addCategory.dataset.focused = 'true';
        taskInput.classList.remove('focused');
        addTime.dataset.focused = 'false';
        const addBtnEl = taskForm.querySelector('.btn-add');
        if (addBtnEl) addBtnEl.classList.remove('focused');
    }

    function closeAddModal() {
        addModal.classList.add('hidden');
        taskForm.reset();
    }

    function addTask(e) {
        e.preventDefault();
        const title = taskInput.value.trim();
        if (!title) return;

        TaskStorage.saveTask({
            title: title,
            category: addCategory.dataset.value,
            timeEstimate: parseInt(addTime.dataset.value, 10)
        });

        taskInput.value = '';
        // Keep category selected for adding multiple tasks

        // Show toast
        showToast('Task added');
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 1500);
    }

    // Manage Modal
    function openManageModal() {
        manageModal.classList.remove('hidden');
        renderManageList();
    }

    function closeManageModal() {
        manageModal.classList.add('hidden');
    }

    function renderManageList() {
        let tasks = TaskStorage.getTasks();

        // Filter by category
        if (manageCategoryValue !== 'all') {
            tasks = tasks.filter(t => t.category === manageCategoryValue);
        }

        // Filter by status
        if (manageStatusValue === 'active') {
            tasks = tasks.filter(t => !t.completed);
        } else if (manageStatusValue === 'completed') {
            tasks = tasks.filter(t => t.completed);
        }

        if (tasks.length === 0) {
            manageList.innerHTML = '';
            manageEmpty.classList.remove('hidden');
            return;
        }

        manageEmpty.classList.add('hidden');
        manageList.innerHTML = tasks.map(renderManageItem).join('');
    }

    function renderManageItem(task) {
        return `
            <div class="manage-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="manage-item-content">
                    <div class="manage-item-title">${escapeHtml(task.title)}</div>
                    <div class="manage-item-meta">${task.category} · ${formatTime(task.timeEstimate)}</div>
                </div>
                <div class="manage-item-actions">
                    <button class="manage-item-btn edit" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="manage-item-btn delete" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    function handleManageAction(e) {
        const btn = e.target.closest('.manage-item-btn');
        if (!btn) return;

        const item = btn.closest('.manage-item');
        const taskId = item.dataset.id;

        if (btn.classList.contains('edit')) {
            startEdit(item, taskId);
        } else if (btn.classList.contains('delete')) {
            deleteTaskById(taskId);
        }
    }

    function startEdit(item, taskId) {
        const titleEl = item.querySelector('.manage-item-title');
        const currentTitle = titleEl.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = currentTitle;

        titleEl.style.display = 'none';
        titleEl.parentNode.insertBefore(input, titleEl);
        input.focus();
        input.select();

        function saveEdit() {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                TaskStorage.updateTask(taskId, { title: newTitle });
            }
            renderManageList();
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                renderManageList();
            }
        });
    }

    function deleteTaskById(taskId) {
        TaskStorage.deleteTask(taskId);
        renderManageList();
    }

    function formatTime(minutes) {
        if (minutes < 60) return minutes + ' min';
        if (minutes === 60) return '1 hour';
        if (minutes < 240) return (minutes / 60) + ' hours';
        return '4+ hours';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
