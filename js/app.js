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
    const taskCategoryIcon = document.getElementById('task-category-icon');
    const taskTimeLimit = document.getElementById('task-time-limit');
    const taskTimer = document.getElementById('task-timer');
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const doneBtn = document.getElementById('done-btn');
    const skipBtn = document.getElementById('skip-btn');

    // Category icons SVG
    const categoryIcons = {
        work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/></svg>',
        personal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
        health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
    };

    // Timer state
    let timerInterval = null;
    let timerSeconds = 0;
    let timerLimit = 0;

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

    // Swipe detection helper
    function addSwipeListener(element, onSwipeLeft, onSwipeRight) {
        let touchStartX = 0;
        let touchEndX = 0;
        const minSwipeDistance = 50;

        element.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        element.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            const distance = touchEndX - touchStartX;
            if (Math.abs(distance) >= minSwipeDistance) {
                if (distance > 0) {
                    onSwipeRight();
                } else {
                    onSwipeLeft();
                }
            }
        }, { passive: true });
    }

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
        updatePickButton();
    }

    function updatePickButton() {
        const category = pickerCategory.dataset.value;
        const maxTime = parseInt(pickerTime.dataset.value, 10);

        let tasks = TaskStorage.getTasks().filter(t => !t.completed);

        if (category !== 'all') {
            tasks = tasks.filter(t => t.category === category);
        }

        if (maxTime > 0) {
            tasks = tasks.filter(t => t.timeEstimate <= maxTime);
        }

        pickBtn.disabled = tasks.length === 0;
    }

    function bindEvents() {
        pickBtn.addEventListener('click', pickTask);
        document.getElementById('close-task').addEventListener('click', closeTask);
        startBtn.addEventListener('click', startTimer);
        resetBtn.addEventListener('click', resetTimer);
        doneBtn.addEventListener('click', completeTask);
        skipBtn.addEventListener('click', skipTask);
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

            // Update pick button state
            updatePickButton();
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

        // Swipe on category wheel (main screen)
        addSwipeListener(pickerCategory,
            function() { // swipe left = next
                const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                updateWheel(currentIndex + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const currentIndex = parseInt(pickerCategory.dataset.index, 10);
                updateWheel(currentIndex - 1);
                playClick('scroll');
            }
        );

        // Time chip selection
        pickerTime.addEventListener('click', function(e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            pickerTime.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            pickerTime.dataset.value = chip.dataset.value;
            playClick('scroll');
            updatePickButton();
        });

        // Swipe on time options (main screen)
        addSwipeListener(pickerTime,
            function() { // swipe left = next
                const idx = getSelectedTimeIndex();
                selectTimeChip(idx + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const idx = getSelectedTimeIndex();
                selectTimeChip(idx - 1);
                playClick('scroll');
            }
        );

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
            updatePickButton();
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

        // Swipe on category wheel (add modal)
        addSwipeListener(addCategory,
            function() { // swipe left = next
                const currentIndex = parseInt(addCategory.dataset.index, 10);
                updateAddWheel(currentIndex + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const currentIndex = parseInt(addCategory.dataset.index, 10);
                updateAddWheel(currentIndex - 1);
                playClick('scroll');
            }
        );

        // Add modal - time chip selection
        addTime.addEventListener('click', function(e) {
            const chip = e.target.closest('.time-chip');
            if (!chip) return;
            addTime.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            addTime.dataset.value = chip.dataset.value;
            playClick('scroll');
        });

        // Swipe on time options (add modal)
        addSwipeListener(addTime,
            function() { // swipe left = next
                const idx = getAddSelectedTimeIndex();
                selectAddTimeChip(idx + 1);
                playClick('scroll');
            },
            function() { // swipe right = prev
                const idx = getAddSelectedTimeIndex();
                selectAddTimeChip(idx - 1);
                playClick('scroll');
            }
        );

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
        document.getElementById('delete-all-btn').addEventListener('click', deleteAllCompleted);

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
        // Stop any running timer
        stopTimer();

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

        // Show category icon
        taskCategoryIcon.innerHTML = categoryIcons[currentTask.category] || categoryIcons.other;

        // Show time limit if applicable
        if (currentTask.timeEstimate > 0) {
            taskTimeLimit.textContent = formatTime(currentTask.timeEstimate);
            timerLimit = currentTask.timeEstimate * 60; // Convert to seconds
            startBtn.classList.remove('hidden');
        } else {
            taskTimeLimit.textContent = '';
            timerLimit = 0;
            startBtn.classList.add('hidden');
        }

        // Reset timer display
        timerSeconds = 0;
        timerDisplay.textContent = '00:00';
        taskTimer.classList.add('hidden');
        taskTimer.classList.remove('running', 'warning', 'overtime');

        taskTitle.textContent = currentTask.title;

        showView(taskView);
    }

    function skipTask() {
        stopTimer();
        pickTask();
    }

    function closeTask() {
        stopTimer();
        currentTask = null;
        showView(promptView);
    }

    function completeTask() {
        stopTimer();
        if (currentTask) {
            TaskStorage.toggleComplete(currentTask.id);
            currentTask = null;
        }
        celebrate();
        showView(promptView);
        updatePickButton();
    }

    function celebrate() {
        // Create burst effect
        const burst = document.createElement('div');
        burst.className = 'celebration-burst';
        document.body.appendChild(burst);

        // Create confetti
        const colors = ['#22c55e', '#4ade80', '#86efac', '#fbbf24', '#60a5fa'];
        const celebration = document.createElement('div');
        celebration.className = 'celebration';

        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.animation = `confetti-fall ${1 + Math.random() * 1}s ease-out forwards`;
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            celebration.appendChild(confetti);
        }

        document.body.appendChild(celebration);

        // Play celebration sound
        playClick('select');

        // Clean up after animation
        setTimeout(function() {
            burst.remove();
            celebration.remove();
        }, 2000);
    }

    // Timer functions
    function startTimer() {
        if (timerInterval) return; // Already running

        // Request notification permission
        requestNotificationPermission();

        // Hide start button, show timer
        startBtn.classList.add('hidden');
        taskTimer.classList.remove('hidden');
        taskTimer.classList.add('running');

        timerInterval = setInterval(function() {
            timerSeconds++;
            updateTimerDisplay();

            // Check for warning (80% of time limit)
            if (timerLimit > 0) {
                const warningThreshold = timerLimit * 0.8;
                if (timerSeconds >= timerLimit) {
                    taskTimer.classList.remove('warning');
                    taskTimer.classList.add('overtime');

                    // Send notification only once when time is up
                    if (timerSeconds === timerLimit) {
                        sendTimerNotification();
                    }
                } else if (timerSeconds >= warningThreshold) {
                    taskTimer.classList.add('warning');
                }
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function resetTimer() {
        stopTimer();
        timerSeconds = 0;
        updateTimerDisplay();
        taskTimer.classList.remove('warning', 'overtime');
        taskTimer.classList.add('running');

        // Restart the timer
        timerInterval = setInterval(function() {
            timerSeconds++;
            updateTimerDisplay();

            if (timerLimit > 0) {
                const warningThreshold = timerLimit * 0.8;
                if (timerSeconds >= timerLimit) {
                    taskTimer.classList.remove('warning');
                    taskTimer.classList.add('overtime');
                    if (timerSeconds === timerLimit) {
                        sendTimerNotification();
                    }
                } else if (timerSeconds >= warningThreshold) {
                    taskTimer.classList.add('warning');
                }
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const hours = Math.floor(timerSeconds / 3600);
        const mins = Math.floor((timerSeconds % 3600) / 60);
        const secs = timerSeconds % 60;

        if (hours > 0) {
            timerDisplay.textContent = String(hours).padStart(2, '0') + ':' +
                                        String(mins).padStart(2, '0') + ':' +
                                        String(secs).padStart(2, '0');
        } else {
            timerDisplay.textContent = String(mins).padStart(2, '0') + ':' +
                                        String(secs).padStart(2, '0');
        }
    }

    // Notification functions
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function sendTimerNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('Time\'s up!', {
                body: currentTask ? currentTask.title : 'Your task timer has ended',
                icon: 'icons/icon-192.svg',
                tag: 'timer-notification',
                requireInteraction: true
            });

            // Auto close after 10 seconds
            setTimeout(function() {
                notification.close();
            }, 10000);
        }

        // Also play a sound
        playClick('select');
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
        // If we were on empty view, go back to prompt view since we may have added tasks
        if (!emptyView.classList.contains('hidden')) {
            showView(promptView);
        }
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

        // Update pick button state
        updatePickButton();
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

        // Sort: active tasks first, then completed
        tasks.sort(function(a, b) {
            if (a.completed === b.completed) return 0;
            return a.completed ? 1 : -1;
        });

        // Check if there are completed tasks to show delete all button
        const allTasks = TaskStorage.getTasks();
        const completedCount = allTasks.filter(t => t.completed).length;
        updateDeleteAllButton(completedCount);

        if (tasks.length === 0) {
            manageList.innerHTML = '';
            manageEmpty.classList.remove('hidden');
            return;
        }

        manageEmpty.classList.add('hidden');
        manageList.innerHTML = tasks.map(renderManageItem).join('');
    }

    function updateDeleteAllButton(completedCount) {
        const deleteAllBtn = document.getElementById('delete-all-btn');
        if (completedCount > 0) {
            deleteAllBtn.classList.remove('hidden');
            deleteAllBtn.textContent = 'Delete ' + completedCount + ' completed';
        } else {
            deleteAllBtn.classList.add('hidden');
        }
    }

    function deleteAllCompleted() {
        const tasks = TaskStorage.getTasks();
        const completedIds = tasks.filter(t => t.completed).map(t => t.id);
        completedIds.forEach(function(id) {
            TaskStorage.deleteTask(id);
        });
        renderManageList();
        updatePickButton();
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
        updatePickButton();
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
