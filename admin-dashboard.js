/* admin-dashboard.js — admin panel controller (vanilla JS, no build step). */
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api/admin';

    // ---------- Small helpers ----------
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const store = {
        get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } },
    };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    // "Producer – Agencies" -> "producer-agencies" (accents folded, everything else becomes a dash)
    const slugify = (name) => String(name || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const safeIconClass = (cls) => String(cls || '').replace(/[^a-z0-9 -]/gi, '').trim();
    const truncate = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // ---------- Theme toggle (localStorage `theme-mode`, class `light-mode` on <html>) ----------
    const themeBtn = document.getElementById('admin-theme-toggle');
    const updateThemeIcon = () => {
        const isLight = document.documentElement.classList.contains('light-mode');
        themeBtn.innerHTML = isLight ? '<i class="fas fa-moon" aria-hidden="true"></i>' : '<i class="fas fa-sun" aria-hidden="true"></i>';
        const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
        themeBtn.setAttribute('aria-label', label);
        themeBtn.dataset.tooltip = isLight ? 'Dark theme' : 'Light theme';
        themeBtn.dataset.tooltipPos = 'bottom-end';
    };
    updateThemeIcon();
    themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('light-mode');
        const isLight = document.documentElement.classList.contains('light-mode');
        store.set('theme-mode', isLight ? 'light' : 'dark');
        updateThemeIcon();
    });

    // Human labels for DB columns shown in forms.
    const FIELD_LABELS = {
        company: { label: 'Company' },
        start_date: { label: 'Start date' },
        end_date: { label: 'End date' },
        institution: { label: 'Institution' },
        link: { label: 'Link (URL)', hint: 'A full URL, or a page on this site such as server-info.html' },
        category_id: { label: 'Category' },
        percentage: { label: 'Proficiency (%)', hint: 'Not shown publicly — 85 and above is highlighted' },
        role: { label: 'Role' },
        degree: { label: 'Degree' },
        name: { label: 'Name' },
        description: { label: 'Description' },
        content: { label: 'Summary text' },
        title: { label: 'Title' },
        icon: { label: 'Icon', hint: 'Font Awesome class, e.g. fas fa-server' },
        layout_type: { label: 'Layout' },
        display_order: { label: 'Order' },
        is_visible: { label: 'Visible' },
        item_type: { label: 'Type' },
        platform: { label: 'Platform' },
        function: { label: 'Function' },
    };
    const fieldLabel = (field, ctx) => {
        if (ctx === 'server_item' && field === 'content') return 'Content';
        if (ctx === 'server_section' && field === 'description') return 'Description';
        return FIELD_LABELS[field]?.label || capitalize(field.replace(/_/g, ' '));
    };
    const fieldHint = (field, ctx) => {
        if (ctx === 'experience' && field === 'description') return 'One line per bullet point.';
        if (field === 'percentage' && ctx !== 'skill') return '';
        return FIELD_LABELS[field]?.hint || '';
    };

    const SECTION_META = {
        experience: {
            plural: 'experiences', label: 'Experience', noun: 'role', addLabel: 'Add role', icon: 'fa-briefcase',
            mainField: 'role', primaryHead: 'Role', secondaryHead: 'Company',
            emptyTitle: 'No experience yet', emptyText: 'Add a role once, then choose which versions show it.',
        },
        education: {
            plural: 'educations', label: 'Education', noun: 'education entry', addLabel: 'Add education', icon: 'fa-graduation-cap',
            mainField: 'degree', primaryHead: 'Degree', secondaryHead: 'Institution',
            emptyTitle: 'No education yet', emptyText: 'Add degrees, programs or courses.',
        },
        project: {
            plural: 'projects', label: 'Projects', noun: 'project', addLabel: 'Add project', icon: 'fa-diagram-project',
            mainField: 'name', primaryHead: 'Project', secondaryHead: 'Link',
            emptyTitle: 'No projects yet', emptyText: 'Showcase side projects, with an optional link.',
        },
        skill: {
            plural: 'skills', label: 'Skills', noun: 'skill', addLabel: 'Add skill', icon: 'fa-layer-group',
            mainField: 'name', primaryHead: 'Skill', secondaryHead: 'Category',
            emptyTitle: 'No skills yet', emptyText: 'Skills are grouped by category on the site.',
        },
        summary: {
            plural: 'summaries', label: 'Summary', noun: 'summary', addLabel: 'Add summary', icon: 'fa-align-left',
            mainField: 'content', primaryHead: 'Summary', secondaryHead: null,
            emptyTitle: 'No summary yet', emptyText: 'Write the short intro shown at the top of the resume.',
        },
    };
    const LAYOUT_LABELS = { list: 'List', text: 'Text', grid: 'Grid', table: 'Table', node: 'Node' };

    const AdminApp = {
        state: {
            versions: [],
            currentVersionId: null,
            pools: { experience: [], education: [], project: [], skill: [], summary: [] },
            visibility: { experience: new Set(), education: new Set(), project: new Set(), skill: new Set(), summary: new Set() },
            skillCategories: [],
            serverSections: [],
            serverItems: new Map(),
            sortConfig: { field: null, direction: 'asc' },
            loaded: false,
            pendingPhoto: null,
            tailorPreview: null,
            tailorRun: 0,
            tailorBusy: false,
        },
        layers: [],
        drawerState: null,
        _versionToken: 0,
        _serverToken: 0,
        _dialogSeq: 0,
        _formSeq: 0,

        elements: {
            versionsList: document.getElementById('versions-list'),
            addVersionForm: document.getElementById('add-version-form'),
            addVersionBtn: document.getElementById('add-version-btn'),
            newVersionName: document.getElementById('new-version-name'),
            settingsManager: document.getElementById('version-settings-manager'),
            currentVersionNameSpan: document.getElementById('current-version-name'),
            settingsForm: document.getElementById('version-settings-form'),
            contentTabs: document.getElementById('tabs'),
            contentPoolContainer: document.getElementById('content-pool-container'),
            modal: document.getElementById('item-modal'),
            modalPanel: document.querySelector('#item-modal .drawer'),
            modalTitle: document.getElementById('modal-title'),
            modalEyebrow: document.getElementById('modal-eyebrow'),
            modalForm: document.getElementById('modal-form'),
            modalSaveBtn: document.getElementById('modal-save-btn'),
            modalCancelBtn: document.getElementById('modal-cancel-btn'),
            tailorModal: document.getElementById('tailor-modal'),
        },

        // Defines the fields for each section's editor form
        formDefinitions: {
            experience: {
                pool: { company: 'text', start_date: 'date', end_date: 'date' },
                details: { language: 'text', role: 'text', description: 'textarea' }
            },
            education: {
                pool: { institution: 'text', start_date: 'date', end_date: 'date' },
                details: { language: 'text', degree: 'text', description: 'textarea' }
            },
            project: {
                pool: { link: 'url' },
                details: { language: 'text', name: 'text', description: 'textarea' }
            },
            skill: {
                pool: {
                    category_id: { type: 'select', options: [] }, // filled from skillCategories
                    percentage: 'number'
                },
                details: { language: 'text', name: 'text' }
            },
            summary: {
                pool: {},
                details: { language: 'text', content: 'textarea' }
            },
            server_section: {
                title: 'text',
                icon: 'text',
                description: 'textarea',
                layout_type: { type: 'select', options: [
                    { value: 'list', label: 'List' },
                    { value: 'text', label: 'Simple Text' },
                    { value: 'grid', label: 'Grid/Cards' },
                    { value: 'table', label: 'Table' },
                    { value: 'node', label: 'Proxmox Node (Split Specs/Services)' }
                ]},
                display_order: 'number',
                is_visible: 'checkbox'
            },
            server_item: {
                item_type: { type: 'select', options: [
                    { value: 'service', label: 'Service (VM/LXC)' },
                    { value: 'spec', label: 'Hardware Spec' }
                ]},
                title: 'text',
                content: 'textarea',
                icon: 'text',
                platform: 'text',
                function: 'text',
                display_order: 'number',
                is_visible: 'checkbox'
            }
        },

        async init() {
            this.skeletonHtml = this.elements.contentPoolContainer.innerHTML;
            this.bindEvents();
            const savedTab = store.get('admin-active-tab');
            if (savedTab && this.elements.contentTabs.querySelector(`.tab-btn[data-tab="${savedTab}"]`)) {
                this.markActiveTab(savedTab);
            }
            this.updateAddButton();
            this.positionTabIndicator();
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.positionTabIndicator());
            await this.loadInitialData();
        },

        bindEvents() {
            const el = this.elements;

            // Versions
            el.addVersionForm.addEventListener('submit', (e) => this.handleAddVersion(e));
            el.versionsList.addEventListener('click', (e) => this.handleVersionAction(e));

            // Tabs
            el.contentTabs.addEventListener('click', (e) => this.handleTabClick(e));
            el.contentTabs.addEventListener('keydown', (e) => this.handleTabKeydown(e));
            let resizeRaf = 0;
            window.addEventListener('resize', () => {
                cancelAnimationFrame(resizeRaf);
                resizeRaf = requestAnimationFrame(() => this.positionTabIndicator());
            });
            document.getElementById('add-item-btn').addEventListener('click', () => {
                const tab = this.getActiveTab();
                if (tab === 'server') this.showServerModal('server_section');
                else this.showModal(tab);
            });

            // Version settings
            el.settingsForm.addEventListener('submit', (e) => this.handleSettingsSave(e));
            el.settingsForm.querySelectorAll('.seg-btn').forEach(btn => {
                btn.addEventListener('click', () => this.setSettingsLang(btn.dataset.lang));
            });
            this.setSettingsLang(store.get('settings-lang') === 'es' ? 'es' : 'en');

            // Content table (delegated)
            el.contentPoolContainer.addEventListener('click', (e) => this.handleContentActionEvent(e));
            el.contentPoolContainer.addEventListener('change', (e) => {
                if (e.target.matches('.visibility-toggle')) {
                    const section = e.target.closest('tr')?.dataset.section;
                    if (section) this.handleVisibilityToggle(e.target, section);
                }
            });

            // Drawer
            el.modalCancelBtn.addEventListener('click', () => this.requestCloseDrawer());
            document.getElementById('drawer-close-btn').addEventListener('click', () => this.requestCloseDrawer());
            el.modal.querySelector('[data-drawer-dismiss]').addEventListener('click', () => this.requestCloseDrawer());
            el.modalSaveBtn.addEventListener('click', () => this.saveDrawer());
            el.modalForm.addEventListener('submit', (e) => { e.preventDefault(); this.saveDrawer(); });
            document.getElementById('kbd-mod').textContent = isMac ? '⌘' : 'Ctrl';

            // Auto-growing textareas (drawer, wizard)
            document.addEventListener('input', (e) => {
                if (e.target.matches && e.target.matches('textarea[data-autogrow]')) this.autoGrow(e.target);
            });

            // Global keyboard: Esc closes the top layer, Tab is trapped, Ctrl/Cmd+S saves the drawer
            document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

            // AI Tailor wizard
            const tailorOpen = document.getElementById('tailor-open-btn');
            if (tailorOpen) tailorOpen.addEventListener('click', () => this.openTailorWizard());
            document.querySelectorAll('.tailor-close-btn').forEach(b => b.addEventListener('click', () => this.requestCloseTailor()));
            const tailorGen = document.getElementById('tailor-generate-btn');
            if (tailorGen) tailorGen.addEventListener('click', () => this.tailorGenerate(false));
            const tailorRegen = document.getElementById('tailor-regenerate-btn');
            if (tailorRegen) tailorRegen.addEventListener('click', () => this.tailorGenerate(true));
            const tailorBack = document.getElementById('tailor-back-btn');
            if (tailorBack) tailorBack.addEventListener('click', () => this.tailorShowStep('input'));
            const tailorCommit = document.getElementById('tailor-commit-btn');
            if (tailorCommit) tailorCommit.addEventListener('click', () => this.tailorCommit());
            const tailorDownloadCover = document.getElementById('tailor-download-cover-letter-btn');
            if (tailorDownloadCover) tailorDownloadCover.addEventListener('click', () => this.tailorDownloadCoverLetter());
            const jd = document.getElementById('tailor-jd');
            if (jd) jd.addEventListener('input', () => this.updateJdCount());
            const skillsList = document.getElementById('tailor-skills-list');
            if (skillsList) skillsList.addEventListener('change', () => this.updateTailorSkillCount());

            // Global profile
            const saveProfileBtn = document.getElementById('save-profile-btn');
            if (saveProfileBtn) saveProfileBtn.addEventListener('click', () => this.handleProfileSave());
            this.bindProfileCollapse();
            this.bindPhotoDropzone();

            // Versions list: collapse toggle (state in localStorage)
            const collapseBtn = document.getElementById('versions-collapse-btn');
            const versionsBody = document.getElementById('versions-body');
            if (collapseBtn && versionsBody) {
                const applyCollapsed = (collapsed) => {
                    versionsBody.classList.toggle('collapsed', collapsed);
                    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
                    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand versions list' : 'Collapse versions list');
                };
                applyCollapsed(store.get('versions-collapsed') === 'true');
                collapseBtn.addEventListener('click', () => {
                    const isCollapsed = !versionsBody.classList.contains('collapsed');
                    applyCollapsed(isCollapsed);
                    store.set('versions-collapsed', isCollapsed);
                });
            }

            // Version settings: collapse toggle (state in localStorage)
            const settingsBtn = document.getElementById('settings-collapse-btn');
            const settingsBody = document.getElementById('settings-body');
            const settingsTools = document.querySelector('.settings-tools');
            if (settingsBtn && settingsBody) {
                const applySettingsCollapsed = (collapsed) => {
                    settingsBody.classList.toggle('hidden', collapsed);
                    if (settingsTools) settingsTools.classList.toggle('hidden', collapsed);
                    this.elements.settingsManager.classList.toggle('is-collapsed', collapsed);
                    settingsBtn.setAttribute('aria-expanded', String(!collapsed));
                };
                applySettingsCollapsed(store.get('settings-collapsed') === 'true');
                settingsBtn.addEventListener('click', () => {
                    const collapsed = !settingsBody.classList.contains('hidden');
                    applySettingsCollapsed(collapsed);
                    store.set('settings-collapsed', collapsed);
                });
            }

            // Versions list: search filter
            const searchInput = document.getElementById('versions-search');
            if (searchInput) searchInput.addEventListener('input', () => this.applyVersionFilter());

            // Logout
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());
        },

        // =====================================================================
        // Layers (drawer, modal, dialogs, menus): Esc, focus trap, return focus
        // =====================================================================
        pushLayer(layer) {
            layer.returnFocus = layer.returnFocus || document.activeElement;
            this.layers.push(layer);
        },
        popLayer(root, { restoreFocus = true } = {}) {
            const idx = this.layers.findIndex(l => l.root === root);
            if (idx === -1) return;
            const [layer] = this.layers.splice(idx, 1);
            if (restoreFocus && layer.returnFocus && document.contains(layer.returnFocus) && typeof layer.returnFocus.focus === 'function') {
                layer.returnFocus.focus({ preventScroll: true });
            }
        },
        topLayer() { return this.layers[this.layers.length - 1]; },

        handleGlobalKeydown(e) {
            const top = this.topLayer();
            if (!top) return;
            if (e.key === 'Escape' && !e.isComposing) {
                e.preventDefault();
                if (top.onEscape) top.onEscape();
                return;
            }
            if (e.key === 'Tab' && top.trap) this.trapFocus(e, top.panel);
            if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S') && top.onSave) {
                e.preventDefault();
                top.onSave();
            }
        },

        trapFocus(e, container) {
            const nodes = Array.from(container.querySelectorAll(FOCUSABLE)).filter(n => n.getClientRects().length > 0);
            if (!nodes.length) { e.preventDefault(); container.focus(); return; }
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || !container.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !container.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        },

        syncScrollLock() {
            const open = document.querySelector('.drawer-root.is-open, .modal-root.is-open, .dialog-root.is-open');
            document.body.classList.toggle('is-locked', !!open);
        },

        showOverlay(root) {
            clearTimeout(root._closeTimer);
            root.classList.remove('hidden', 'is-closing');
            void root.offsetWidth; // commit the closed state so the transition runs
            root.classList.add('is-open');
            this.syncScrollLock();
        },

        hideOverlay(root, duration = 320, after) {
            root.classList.remove('is-open');
            root.classList.add('is-closing');
            this.syncScrollLock();
            const done = () => {
                root.classList.add('hidden');
                root.classList.remove('is-closing');
                if (after) after();
            };
            clearTimeout(root._closeTimer);
            if (reducedMotion()) done();
            else root._closeTimer = setTimeout(done, duration);
        },

        // =====================================================================
        // Feedback: toasts, dialogs, busy buttons
        // =====================================================================
        notify(message, type = 'success') {
            let stack = document.querySelector('.toast-stack');
            if (!stack) {
                stack = document.createElement('div');
                stack.className = 'toast-stack';
                stack.setAttribute('aria-live', 'polite');
                document.body.appendChild(stack);
            }
            const duration = type === 'error' ? 6500 : 4000;
            const toast = document.createElement('div');
            toast.className = `toast toast--${type}`;
            toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
            toast.innerHTML = `
                <span class="toast-icon" aria-hidden="true"><i class="fas ${type === 'error' ? 'fa-exclamation' : 'fa-check'}"></i></span>
                <p class="toast-msg"></p>
                <button type="button" class="btn-icon toast-close" aria-label="Dismiss notification"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                <span class="toast-progress" style="animation-duration:${duration}ms" aria-hidden="true"></span>`;
            toast.querySelector('.toast-msg').textContent = message;

            let gone = false;
            const dismiss = () => {
                if (gone) return;
                gone = true;
                if (reducedMotion()) { toast.remove(); return; }
                toast.classList.add('is-leaving');
                setTimeout(() => toast.remove(), 220);
            };
            toast.querySelector('.toast-close').addEventListener('click', dismiss);
            if (reducedMotion()) setTimeout(dismiss, duration);
            else toast.querySelector('.toast-progress').addEventListener('animationend', dismiss);

            stack.appendChild(toast);
            const live = stack.querySelectorAll('.toast:not(.is-leaving)');
            if (live.length > 4) live[0].querySelector('.toast-close').click();
        },

        confirmDialog(message, { title = 'Are you sure?', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
            return this.openDialog({ kind: 'confirm', message, title, confirmLabel, cancelLabel, danger });
        },

        promptDialog(message, { title = 'Enter a value', placeholder = '', confirmLabel = 'OK', cancelLabel = 'Cancel', value = '' } = {}) {
            return this.openDialog({ kind: 'prompt', message, title, placeholder, confirmLabel, cancelLabel, value });
        },

        openDialog(opts) {
            return new Promise((resolve) => {
                const id = `dlg-${++this._dialogSeq}`;
                const isPrompt = opts.kind === 'prompt';
                const icon = opts.danger ? 'fa-triangle-exclamation' : (isPrompt ? 'fa-pen' : 'fa-circle-question');
                const root = document.createElement('div');
                root.className = 'dialog-root';
                root.innerHTML = `
                    <div class="dialog-backdrop" data-dialog-cancel></div>
                    <div class="dialog" role="${isPrompt ? 'dialog' : 'alertdialog'}" aria-modal="true" aria-labelledby="${id}-title" ${opts.message ? `aria-describedby="${id}-msg"` : ''} tabindex="-1">
                        <div class="dialog-icon ${opts.danger ? 'is-danger' : ''}" aria-hidden="true"><i class="fas ${icon}"></i></div>
                        <h2 class="dialog-title" id="${id}-title">${esc(opts.title)}</h2>
                        ${opts.message ? `<p class="dialog-message" id="${id}-msg">${esc(opts.message)}</p>` : ''}
                        ${isPrompt ? `<input type="text" class="dialog-input" placeholder="${esc(opts.placeholder)}" value="${esc(opts.value)}" aria-labelledby="${id}-title" maxlength="80">` : ''}
                        <div class="dialog-actions">
                            <button type="button" class="btn btn-secondary" data-dialog-cancel>${esc(opts.cancelLabel)}</button>
                            <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-dialog-confirm>${esc(opts.confirmLabel)}</button>
                        </div>
                    </div>`;
                document.body.appendChild(root);
                const panel = root.querySelector('.dialog');
                const input = root.querySelector('.dialog-input');
                const confirmBtn = root.querySelector('[data-dialog-confirm]');
                const cancelBtn = root.querySelector('.dialog-actions [data-dialog-cancel]');

                let settled = false;
                const finish = (result) => {
                    if (settled) return;
                    settled = true;
                    this.popLayer(root);
                    root.classList.remove('is-open');
                    this.syncScrollLock();
                    setTimeout(() => root.remove(), reducedMotion() ? 0 : 220);
                    resolve(result);
                };
                const accept = () => {
                    if (isPrompt) {
                        const v = input.value.trim();
                        if (!v) { input.focus(); return; }
                        finish(v);
                    } else {
                        finish(true);
                    }
                };
                const cancelValue = isPrompt ? null : false;

                root.addEventListener('click', (e) => {
                    if (e.target.closest('[data-dialog-confirm]')) accept();
                    else if (e.target.closest('[data-dialog-cancel]')) finish(cancelValue);
                });
                if (input) {
                    const sync = () => { confirmBtn.disabled = !input.value.trim(); };
                    sync();
                    input.addEventListener('input', sync);
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); accept(); }
                    });
                }

                this.pushLayer({ root, panel, trap: true, onEscape: () => finish(cancelValue) });
                requestAnimationFrame(() => { root.classList.add('is-open'); this.syncScrollLock(); });
                if (input) { input.focus(); input.select(); }
                else (opts.danger ? cancelBtn : confirmBtn).focus();
            });
        },

        // Swap a button into a busy state; returns a restore function.
        setBusy(btn, label = '') {
            if (!btn) return () => {};
            const html = btn.innerHTML;
            btn.style.minWidth = `${btn.offsetWidth}px`;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label ? `<span>${esc(label)}</span>` : ''}`;
            return () => {
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerHTML = html;
                btn.style.minWidth = '';
            };
        },

        autoGrow(ta) {
            if (!ta || !ta.isConnected || !ta.getClientRects().length) return;
            const max = 520;
            ta.style.height = 'auto';
            const h = ta.scrollHeight + 2;
            ta.style.height = `${Math.min(h, max)}px`;
            ta.classList.toggle('is-capped', h > max);
        },

        friendlyError(msg, fallback) {
            if (!msg) return fallback;
            if (/duplicate key|unique constraint|already exists/i.test(msg)) {
                return 'That name or link is already taken — pick a different name.';
            }
            return `${fallback} (${msg})`;
        },

        async handleLogout() {
            const ok = await this.confirmDialog('You’ll need your password to get back in.', { title: 'Log out?', confirmLabel: 'Log out' });
            if (!ok) return;
            try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login';
            } catch (err) {
                this.notify('Logout failed', 'error');
            }
        },

        // =====================================================================
        // Data loading
        // =====================================================================
        async loadInitialData() {
            try {
                await Promise.all([
                    this.loadVersions(),
                    this.loadGlobalProfile(),
                    this.loadSkillCategories(),
                    this.loadServerSections(),
                    this.loadAllPools(),
                ]);
            } catch (err) {
                console.error('Initial load failed:', err);
                this.notify('Could not load all admin data. Check your connection and reload.', 'error');
            }
            this.state.loaded = true;
            const saved = parseInt(store.get('admin-current-version'), 10);
            const initialId = this.findVersion(saved) ? saved : this.state.versions[0]?.id;
            if (initialId) {
                await this.setActiveVersion(initialId);
            } else {
                this.updateVersionContext();
                this.updateTabCounts();
                this.elements.contentPoolContainer.setAttribute('aria-busy', 'false');
                this.renderActiveTabContent();
            }
        },

        async loadServerSections() {
            this.state.serverSections = await this.apiGet('/server-sections');
        },
        async loadVersions() {
            this.state.versions = await this.apiGet('/versions');
            this.renderVersionsList();
        },
        async loadSkillCategories() {
            try {
                this.state.skillCategories = await this.apiGet('/skill_categories');
            } catch (err) {
                console.error('Error loading skill categories:', err);
                this.state.skillCategories = [];
            }
        },
        async loadAllPools() {
            await Promise.all(Object.keys(this.state.pools).map(async (section) => {
                // Summary is an exception: plural is summaries, not summarys
                const plural = section === 'summary' ? 'summaries' : section + 's';
                this.state.pools[section] = await this.apiGet(`/${plural}`);
            }));
        },
        async loadDataForCurrentVersion() {
            if (!this.state.currentVersionId) return;
            const token = ++this._versionToken;
            this.state.settingsVersionId = null;
            this.state.visibilityVersionId = null;
            const container = this.elements.contentPoolContainer;
            container.setAttribute('aria-busy', 'true');
            try {
                await Promise.all([this.loadVersionSettings(token), this.loadVisibility(token)]);
            } catch (err) {
                console.error('Error loading version data:', err);
            }
            if (token !== this._versionToken) return;
            container.setAttribute('aria-busy', 'false');
            this.updateTabCounts();
            if (this.getActiveTab() !== 'server' || !container.querySelector('.server-list, .empty-state')) {
                this.renderActiveTabContent();
            }
        },

        async loadGlobalProfile() {
            try {
                const response = await fetch(`${API_BASE_URL}/global_profile`);
                if (response.status === 401) { window.location.href = '/login'; return; }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const contactInfo = await response.json();
                if (!contactInfo) throw new Error('Empty profile response');

                ['name', 'email', 'phone', 'linkedin', 'github', 'website'].forEach(key => {
                    const el = document.getElementById(`contact-${key}`);
                    if (el) el.value = contactInfo[key] || '';
                });
                const picHidden = document.getElementById('contact-profile_picture');
                if (picHidden) picHidden.value = contactInfo.profile_picture || '';
                this.updateProfilePreview(contactInfo.profile_picture);
                this.updateProfileSummary();
                this.state.profileLoaded = true;
            } catch (err) {
                this.state.profileLoaded = false;
                this.notify('Couldn’t load your profile. Reload the page before editing it.', 'error');
            }
        },

        updateProfilePreview(url) {
            const picPreview = document.getElementById('current-profile-pic-preview');
            const drop = document.getElementById('photo-drop');
            const mini = document.getElementById('profile-mini-avatar');
            const img = url ? `<img src="${esc(url)}" alt="">` : '';
            if (picPreview) picPreview.innerHTML = img;
            if (drop) drop.classList.toggle('has-image', !!url);
            if (mini) mini.innerHTML = img || '<i class="fas fa-user" aria-hidden="true"></i>';
        },

        updateProfileSummary() {
            const panel = document.getElementById('global-profile-section');
            const summary = document.getElementById('profile-summary');
            if (!panel || !summary) return;
            if (panel.classList.contains('is-collapsed')) {
                const name = document.getElementById('contact-name')?.value.trim();
                const email = document.getElementById('contact-email')?.value.trim();
                summary.textContent = [name, email].filter(Boolean).join(' · ') || 'Shared across all versions';
            } else {
                summary.textContent = 'Shared across all versions';
            }
        },

        bindProfileCollapse() {
            const panel = document.getElementById('global-profile-section');
            const btn = document.getElementById('profile-collapse-btn');
            const body = document.getElementById('profile-body');
            const saveBtn = document.getElementById('save-profile-btn');
            if (!panel || !btn || !body) return;
            const apply = (collapsed) => {
                panel.classList.toggle('is-collapsed', collapsed);
                body.classList.toggle('hidden', collapsed);
                if (saveBtn) saveBtn.classList.toggle('hidden', collapsed);
                btn.setAttribute('aria-expanded', String(!collapsed));
                this.updateProfileSummary();
            };
            apply(store.get('profile-collapsed') === 'true');
            btn.addEventListener('click', () => {
                const collapsed = !panel.classList.contains('is-collapsed');
                apply(collapsed);
                store.set('profile-collapsed', collapsed);
            });
        },

        bindPhotoDropzone() {
            const drop = document.getElementById('photo-drop');
            const input = document.getElementById('contact-profile-pic');
            if (!drop || !input) return;
            drop.addEventListener('click', () => input.click());
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (file) this.setPendingPhoto(file, false);
            });
            ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, (e) => {
                e.preventDefault();
                drop.classList.add('is-dragover');
            }));
            ['dragleave', 'dragend', 'drop'].forEach(type => drop.addEventListener(type, () => drop.classList.remove('is-dragover')));
            drop.addEventListener('drop', (e) => {
                e.preventDefault();
                const file = e.dataTransfer?.files?.[0];
                if (file) this.setPendingPhoto(file, true);
            });
        },

        setPendingPhoto(file, fromDrop) {
            if (!file.type || !file.type.startsWith('image/')) {
                this.notify('That file isn’t an image. Use a JPG, PNG or WebP.', 'error');
                return;
            }
            const input = document.getElementById('contact-profile-pic');
            this.state.pendingPhoto = file;
            if (fromDrop && input) {
                try {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                } catch (e) { /* older browsers: pendingPhoto is used on save */ }
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const preview = document.getElementById('current-profile-pic-preview');
                if (preview) preview.innerHTML = `<img src="${ev.target.result}" alt="New photo preview">`;
                document.getElementById('photo-drop')?.classList.add('has-image');
            };
            reader.readAsDataURL(file);
            const hint = document.getElementById('photo-hint');
            if (hint) { hint.textContent = 'New photo · save to apply'; hint.classList.add('is-pending'); }
        },

        async handleProfileSave() {
            // Saving blank fields after a failed load would wipe the profile on every version.
            if (!this.state.profileLoaded) {
                this.notify('Your profile didn’t load, so it can’t be saved. Reload the page and try again.', 'error');
                return;
            }
            const formData = new FormData();
            ['name', 'email', 'phone', 'linkedin', 'github', 'website'].forEach(key => {
                const el = document.getElementById(`contact-${key}`);
                if (el) formData.append(key, el.value);
            });
            const picHidden = document.getElementById('contact-profile_picture');
            if (picHidden) formData.append('profile_picture', picHidden.value);
            const picFile = document.getElementById('contact-profile-pic');
            const file = (picFile && picFile.files[0]) || this.state.pendingPhoto;
            if (file) formData.append('profile_pic', file);

            const restore = this.setBusy(document.getElementById('save-profile-btn'), 'Saving…');
            try {
                const response = await fetch(`${API_BASE_URL}/global_profile`, { method: 'PUT', body: formData });
                if (response.status === 401) { window.location.href = '/login'; return; }
                const result = await this.parseResponse(response);
                if (!response.ok || !result || result.error) throw new Error(result?.error || 'Save failed');
                // Update hidden field and preview with whatever the server persisted
                if (result.profile_picture !== undefined) {
                    if (picHidden) picHidden.value = result.profile_picture || '';
                    this.updateProfilePreview(result.profile_picture);
                }
                this.state.pendingPhoto = null;
                if (picFile) picFile.value = '';
                const hint = document.getElementById('photo-hint');
                if (hint) { hint.textContent = 'Click or drop an image'; hint.classList.remove('is-pending'); }
                this.updateProfileSummary();
                this.notify('Profile saved.');
            } catch (err) {
                this.notify('Failed to save profile.', 'error');
            } finally {
                restore();
            }
        },

        async loadVersionSettings(token) {
            const version = this.currentVersion();
            if (!version) return;
            const contactInfoResponse = await this.apiGet(`/contact_info/${version.id}`);
            if (token !== undefined && token !== this._versionToken) return;
            const contactInfo = Array.isArray(contactInfoResponse) ? contactInfoResponse[0] : contactInfoResponse;
            // A failed load leaves the form unsaveable instead of saving blanks into this version.
            this.state.settingsVersionId = contactInfo ? version.id : null;

            this.elements.currentVersionNameSpan.textContent = version.name;
            this.elements.settingsForm.querySelectorAll('[data-field]').forEach(el => {
                const field = el.dataset.field;
                el[el.type === 'checkbox' ? 'checked' : 'value'] = version[field] || (el.type === 'checkbox' ? false : '');
            });

            // Version-specific subtitle fields
            ['subtitle', 'subtitle_es'].forEach(key => {
                const el = document.getElementById(`contact-${key}`);
                if (el) el.value = (contactInfo && contactInfo[key]) || '';
            });

            this.elements.settingsManager.classList.remove('hidden');
        },

        async loadVisibility(token) {
            const versionId = this.state.currentVersionId;
            if (!versionId) return;
            const entries = await Promise.all(Object.keys(this.state.pools).map(async (section) => {
                try {
                    const visibleItems = await this.apiGet(`/visibility/${versionId}/${section}`);
                    const rows = Array.isArray(visibleItems) ? visibleItems : [];
                    return [section, new Set(rows.filter(item => item && item.is_visible).map(item => item.pool_id))];
                } catch (err) {
                    console.error(`Error loading visibility for ${section}:`, err);
                    return [section, new Set()];
                }
            }));
            if (token !== undefined && token !== this._versionToken) return;
            entries.forEach(([section, set]) => { this.state.visibility[section] = set; });
            this.state.visibilityVersionId = versionId;
        },

        // =====================================================================
        // Versions
        // =====================================================================
        findVersion(id) { return this.state.versions.find(v => v.id === id) || null; },
        currentVersion() { return this.findVersion(this.state.currentVersionId); },

        renderVersionsList() {
            const list = this.elements.versionsList;
            list.setAttribute('aria-busy', 'false');
            const count = document.getElementById('versions-count');
            if (count) count.textContent = String(this.state.versions.length);

            if (!this.state.versions.length) {
                list.innerHTML = '<li class="list-empty">No versions yet — create one above.</li>';
                return;
            }
            list.innerHTML = this.state.versions.map(version => {
                const active = version.id === this.state.currentVersionId;
                const name = esc(version.name);
                const publicUrl = `/?v=${encodeURIComponent(version.slug)}`;
                return `
                    <li class="version-row${active ? ' active' : ''}" data-id="${version.id}">
                        <button type="button" class="version-select" aria-current="${active ? 'true' : 'false'}">
                            <span class="version-name">${name}</span>
                        </button>
                        <a class="version-slug-link" href="${publicUrl}" target="_blank" rel="noopener" aria-label="Open /${esc(version.slug)} in a new tab">/${esc(version.slug)} <span aria-hidden="true">↗</span></a>
                        <div class="version-actions">
                            <button type="button" class="btn-icon download-version-btn" aria-label="Download PDF of ${name}" aria-haspopup="menu" aria-expanded="false" data-tooltip="PDF"><i class="fas fa-file-pdf" aria-hidden="true"></i></button>
                            <button type="button" class="btn-icon duplicate-version-btn" aria-label="Duplicate ${name}" data-tooltip="Duplicate"><i class="fas fa-copy" aria-hidden="true"></i></button>
                            <button type="button" class="btn-icon edit-version-btn" aria-label="Rename ${name}" data-tooltip="Rename"><i class="fas fa-pen" aria-hidden="true"></i></button>
                            <button type="button" class="btn-icon btn-icon-danger delete-version-btn" aria-label="Delete ${name}" data-tooltip="Delete"><i class="fas fa-trash-can" aria-hidden="true"></i></button>
                        </div>
                    </li>`;
            }).join('');
            this.applyVersionFilter();
        },

        applyVersionFilter() {
            const input = document.getElementById('versions-search');
            const q = (input?.value || '').trim().toLowerCase();
            const list = this.elements.versionsList;
            let shown = 0;
            list.querySelectorAll('.version-row').forEach(li => {
                const v = this.findVersion(parseInt(li.dataset.id, 10));
                const hay = `${v?.name || ''} ${v?.slug || ''}`.toLowerCase();
                const match = !q || hay.includes(q);
                li.classList.toggle('hidden', !match);
                if (match) shown++;
            });
            let empty = list.querySelector('.list-empty.is-filter');
            if (q && shown === 0 && this.state.versions.length) {
                if (!empty) {
                    empty = document.createElement('li');
                    empty.className = 'list-empty is-filter';
                    list.appendChild(empty);
                }
                empty.textContent = `No versions match “${input.value.trim()}”.`;
            } else if (empty) {
                empty.remove();
            }
        },

        updateVersionContext() {
            const v = this.currentVersion();
            const link = document.getElementById('view-site-link');
            if (link) {
                link.href = v ? `/?v=${encodeURIComponent(v.slug)}` : '/';
                link.setAttribute('aria-label', v ? `View ${v.name} on the public site (opens in a new tab)` : 'View the public site (opens in a new tab)');
            }
            this.updateContextLine();
        },

        updateContextLine() {
            const el = document.getElementById('context-line');
            if (!el) return;
            const v = this.currentVersion();
            if (this.getActiveTab() === 'server') {
                const href = v ? `/server-info.html?v=${encodeURIComponent(v.slug)}` : '/server-info.html';
                el.innerHTML = `The server page is shared by every version <a class="context-slug" href="${href}" target="_blank" rel="noopener">/server-info ↗</a>`;
            } else if (v) {
                el.innerHTML = `Showing what <strong>${esc(v.name)}</strong> displays <a class="context-slug" href="/?v=${encodeURIComponent(v.slug)}" target="_blank" rel="noopener" aria-label="Open /${esc(v.slug)} in a new tab">/${esc(v.slug)} ↗</a>`;
            } else if (!this.state.loaded) {
                el.textContent = 'Loading versions…';
            } else {
                el.textContent = this.state.versions.length ? 'Select a version to choose what it shows.' : 'Create a version to choose what it shows.';
            }
        },

        handleVersionAction(e) {
            const li = e.target.closest('.version-row');
            if (!li) return;
            const btn = e.target.closest('button');
            if (!btn || !li.contains(btn)) return; // e.g. the public slug link
            const id = parseInt(li.dataset.id, 10);

            if (btn.matches('.version-select')) {
                if (id !== this.state.currentVersionId) this.setActiveVersion(id);
            } else if (btn.matches('.edit-version-btn')) {
                this.handleEditVersion(li, id);
            } else if (btn.matches('.duplicate-version-btn')) {
                this.handleDuplicateVersion(id);
            } else if (btn.matches('.delete-version-btn')) {
                this.handleDeleteVersion(id);
            } else if (btn.matches('.download-version-btn')) {
                this.handleDownloadVersion(id, btn);
            }
        },

        async handleDuplicateVersion(id) {
            const v = this.findVersion(id);
            if (!v) return;
            const ok = await this.confirmDialog(
                `Creates a full copy of “${v.name}”: visible content, AI-tailored text, subtitles and section settings.`,
                { title: 'Duplicate version?', confirmLabel: 'Duplicate' }
            );
            if (!ok) return;
            try {
                const res = await this.apiPost(`/versions/duplicate/${id}`, {});
                if (!res || res.error) throw new Error(this.friendlyError(res?.error, 'Failed to duplicate version.'));
                await this.loadVersions();
                const created = res.id ? this.findVersion(res.id) : null;
                if (created) await this.setActiveVersion(created.id);
                this.notify(created ? `Duplicated as “${created.name}”.` : 'Version duplicated.');
            } catch (error) {
                console.error('Error duplicating version:', error);
                this.notify(error.message || 'Failed to duplicate version.', 'error');
            }
        },

        async handleDeleteVersion(id) {
            const v = this.findVersion(id);
            if (!v) return;
            const ok = await this.confirmDialog(
                `Its public link /?v=${v.slug} will stop working. Your content library isn’t affected. This can’t be undone.`,
                { title: `Delete “${v.name}”?`, confirmLabel: 'Delete version', danger: true }
            );
            if (!ok) return;
            const res = await this.apiDelete(`/versions/${id}`);
            if (!res) return;
            if (!res.ok) {
                const data = await this.parseResponse(res);
                this.notify(this.friendlyError(data?.error, 'Could not delete this version.'), 'error');
                return;
            }
            const wasCurrent = id === this.state.currentVersionId;
            await this.loadVersions();
            this.notify(`Deleted “${v.name}”.`);
            if (wasCurrent || !this.currentVersion()) {
                this.state.currentVersionId = null;
                this.elements.settingsManager.classList.add('hidden');
                if (this.state.versions.length) {
                    await this.setActiveVersion(this.state.versions[0].id);
                } else {
                    this.updateVersionContext();
                    this.updateTabCounts();
                    this.renderActiveTabContent();
                }
            }
        },

        closeMenu() {
            const menu = document.querySelector('.adm-menu');
            if (!menu) return;
            menu._cleanup?.();
        },

        handleDownloadVersion(id, anchorBtn) {
            const wasOpenForThis = anchorBtn.getAttribute('aria-expanded') === 'true';
            this.closeMenu();
            if (wasOpenForThis) return;

            const version = this.findVersion(id);
            const menu = document.createElement('div');
            menu.className = 'adm-menu';
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', `Download PDF of ${version ? version.name : 'version'}`);
            menu.innerHTML = `
                <div class="adm-menu-label" aria-hidden="true">Download PDF</div>
                <button type="button" class="adm-menu-item" role="menuitem" data-lang="en"><span class="menu-code">EN</span> English <i class="fas fa-arrow-down" aria-hidden="true"></i></button>
                <button type="button" class="adm-menu-item" role="menuitem" data-lang="es"><span class="menu-code">ES</span> Español <i class="fas fa-arrow-down" aria-hidden="true"></i></button>`;
            document.body.appendChild(menu);

            // Anchor below the PDF button, right-aligned to it, kept inside the viewport.
            const rect = anchorBtn.getBoundingClientRect();
            const mw = menu.offsetWidth;
            const mh = menu.offsetHeight;
            let left = Math.max(8, Math.min(rect.right - mw, window.innerWidth - mw - 8));
            let top = rect.bottom + 6;
            if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6);
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
            anchorBtn.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => menu.classList.add('is-open'));

            const items = Array.from(menu.querySelectorAll('.adm-menu-item'));
            const onPointerDown = (ev) => {
                if (!menu.contains(ev.target) && !anchorBtn.contains(ev.target)) cleanup(false);
            };
            const onScroll = (ev) => { if (!(ev.target instanceof Node) || !menu.contains(ev.target)) cleanup(false); };
            const onResize = () => cleanup(false);
            const cleanup = (restoreFocus = true) => {
                document.removeEventListener('pointerdown', onPointerDown, true);
                window.removeEventListener('scroll', onScroll, true);
                window.removeEventListener('resize', onResize);
                // focus back first (while the button is still shown); also when focus was inside the menu
                const focusInside = menu.contains(document.activeElement);
                this.popLayer(menu, { restoreFocus: restoreFocus || focusInside });
                anchorBtn.setAttribute('aria-expanded', 'false');
                menu.classList.remove('is-open');
                setTimeout(() => menu.remove(), reducedMotion() ? 0 : 160);
                menu._cleanup = null;
            };
            menu._cleanup = () => cleanup(false);

            menu.addEventListener('click', (e) => {
                const item = e.target.closest('[data-lang]');
                if (!item) return;
                window.open(`/api/download/pdf/${id}/${item.dataset.lang}`, '_blank');
                cleanup(true);
            });
            menu.addEventListener('keydown', (e) => {
                const idx = items.indexOf(document.activeElement);
                if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
                else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
                else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
                else if (e.key === 'Tab') { cleanup(false); }
            });
            document.addEventListener('pointerdown', onPointerDown, true);
            window.addEventListener('scroll', onScroll, true);
            window.addEventListener('resize', onResize);

            this.pushLayer({ root: menu, panel: menu, trap: false, returnFocus: anchorBtn, onEscape: () => cleanup(true) });
            items[0].focus({ preventScroll: true });
        },

        handleEditVersion(li, id) {
            const version = this.findVersion(id);
            if (!version || li.classList.contains('is-renaming')) return;
            const selectBtn = li.querySelector('.version-select');
            const slugLink = li.querySelector('.version-slug-link');
            const currentName = version.name;

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'version-rename-input';
            input.maxLength = 80;
            input.setAttribute('aria-label', `New name for ${currentName}`);

            li.classList.add('is-renaming');
            selectBtn.classList.add('hidden');
            li.insertBefore(input, li.firstChild);
            input.focus();
            input.select();

            let done = false;
            const restore = () => {
                input.remove();
                selectBtn.classList.remove('hidden');
                slugLink.classList.remove('hidden');
                li.classList.remove('is-renaming');
            };
            const save = async () => {
                if (done) return;
                done = true;
                const newName = input.value.trim();
                if (!newName) {
                    this.notify('A version needs a name — kept the old one.', 'error');
                    restore();
                    return;
                }
                if (newName === currentName) { restore(); return; }
                // Create URL slug from name: "My CV" -> "my-cv"
                const newSlug = slugify(newName);
                if (!newSlug) {
                    this.notify('Use at least one letter or number in the name.', 'error');
                    restore();
                    return;
                }
                if (this.state.versions.some(v => v.id !== id && (v.slug === newSlug || v.name.toLowerCase() === newName.toLowerCase()))) {
                    this.notify(`A version called “${newName}” already exists.`, 'error');
                    restore();
                    return;
                }
                input.disabled = true;
                try {
                    const res = await this.apiPut(`/versions/${id}`, { name: newName, slug: newSlug });
                    if (!res || res.error) throw new Error(this.friendlyError(res?.error, 'Failed to update version.'));
                    await this.loadVersions(); // refresh all
                    this.updateVersionContext();
                    if (id === this.state.currentVersionId) this.elements.currentVersionNameSpan.textContent = newName;
                    this.notify(`Renamed to “${newName}”.`);
                } catch (error) {
                    this.notify(error.message || 'Failed to update version.', 'error');
                    restore();
                }
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    done = true;
                    restore();
                    selectBtn.focus();
                }
            });
        },

        setActiveVersion(id) {
            this.state.currentVersionId = id;
            store.set('admin-current-version', id);
            this.elements.versionsList.querySelectorAll('.version-row').forEach(li => {
                const on = parseInt(li.dataset.id, 10) === id;
                li.classList.toggle('active', on);
                li.querySelector('.version-select')?.setAttribute('aria-current', on ? 'true' : 'false');
            });
            this.updateVersionContext();
            return this.loadDataForCurrentVersion();
        },

        async handleAddVersion(e) {
            if (e) e.preventDefault();
            const input = this.elements.newVersionName;
            const name = input.value.trim();
            if (!name) {
                this.notify('Type a name for the new version first.', 'error');
                input.focus();
                return;
            }
            const slug = slugify(name);
            if (!slug) {
                this.notify('Use at least one letter or number in the name.', 'error');
                input.focus();
                return;
            }
            if (this.state.versions.some(v => v.slug === slug || v.name.toLowerCase() === name.toLowerCase())) {
                this.notify(`A version called “${name}” already exists.`, 'error');
                input.focus();
                input.select();
                return;
            }
            const restore = this.setBusy(this.elements.addVersionBtn);
            try {
                const res = await this.apiPost('/versions', { name, slug });
                if (!res || res.error) throw new Error(this.friendlyError(res?.error, 'Could not create the version.'));
                input.value = '';
                await this.loadVersions();
                if (res.id && this.findVersion(res.id)) await this.setActiveVersion(res.id);
                this.notify(`Created “${name}”.`);
            } catch (err) {
                this.notify(err.message, 'error');
            } finally {
                restore();
            }
        },

        // =====================================================================
        // Tabs
        // =====================================================================
        getActiveTab() {
            return this.elements.contentTabs.querySelector('.tab-btn.active')?.dataset.tab || 'experience';
        },

        markActiveTab(tab) {
            let target = null;
            this.elements.contentTabs.querySelectorAll('.tab-btn').forEach(b => {
                const on = b.dataset.tab === tab;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', String(on));
                b.tabIndex = on ? 0 : -1;
                if (on) target = b;
            });
            return target;
        },

        setActiveTab(tab, { focus = false } = {}) {
            const target = this.markActiveTab(tab);
            if (!target) return;
            if (focus) target.focus();
            // keep the active tab visible inside the horizontally scrolling strip
            const wrap = this.elements.contentTabs.parentElement;
            if (wrap && wrap.scrollWidth > wrap.clientWidth) {
                const l = target.offsetLeft - 24;
                const r = target.offsetLeft + target.offsetWidth + 24 - wrap.clientWidth;
                if (wrap.scrollLeft > l) wrap.scrollLeft = l;
                else if (wrap.scrollLeft < r) wrap.scrollLeft = r;
            }
            store.set('admin-active-tab', tab);
            this.positionTabIndicator();
            this.updateAddButton();
            this.updateContextLine();
            this.renderActiveTabContent({ animate: true });
        },

        handleTabClick(e) {
            const btn = e.target.closest('.tab-btn');
            if (!btn || btn.classList.contains('active')) return;
            this.setActiveTab(btn.dataset.tab);
        },

        handleTabKeydown(e) {
            const tabs = Array.from(this.elements.contentTabs.querySelectorAll('.tab-btn'));
            const idx = tabs.indexOf(document.activeElement);
            if (idx === -1) return;
            let next = null;
            if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length];
            else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length];
            else if (e.key === 'Home') next = tabs[0];
            else if (e.key === 'End') next = tabs[tabs.length - 1];
            if (!next) return;
            e.preventDefault();
            this.setActiveTab(next.dataset.tab, { focus: true });
        },

        positionTabIndicator() {
            const active = this.elements.contentTabs.querySelector('.tab-btn.active');
            const indicator = this.elements.contentTabs.querySelector('.tab-indicator');
            if (!active || !indicator || !active.offsetWidth) return;
            indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
            if (!indicator.classList.contains('is-ready')) {
                requestAnimationFrame(() => requestAnimationFrame(() => indicator.classList.add('is-ready')));
            }
        },

        updateAddButton() {
            const tab = this.getActiveTab();
            const label = tab === 'server' ? 'Add section' : (SECTION_META[tab]?.addLabel || 'Add');
            const labelEl = document.getElementById('add-item-label');
            if (labelEl) labelEl.textContent = label;
            document.getElementById('add-item-btn')?.setAttribute('aria-label', label);
        },

        updateTabCounts() {
            Object.keys(this.state.pools).forEach(section => {
                const el = this.elements.contentTabs.querySelector(`[data-count="${section}"]`);
                if (!el) return;
                if (!this.state.loaded) { el.textContent = '–'; return; }
                const items = this.state.pools[section] || [];
                if (this.state.currentVersionId) {
                    const visible = items.filter(p => this.state.visibility[section].has(p.id)).length;
                    el.textContent = `${visible}/${items.length}`;
                    el.title = `${visible} of ${items.length} shown on this version`;
                } else {
                    el.textContent = String(items.length);
                    el.title = `${items.length} in the library`;
                }
            });
            this.positionTabIndicator();
        },

        // =====================================================================
        // Content rendering
        // =====================================================================
        renderActiveTabContent({ animate = false } = {}) {
            const container = this.elements.contentPoolContainer;
            const tab = this.getActiveTab();
            if (!this.state.loaded) {
                container.innerHTML = this.skeletonHtml;
                return;
            }
            if (tab === 'server') {
                this.renderServerTab();
            } else {
                this.renderContentPool(tab);
            }
            if (animate && !reducedMotion()) {
                container.classList.remove('pool-enter');
                void container.offsetWidth;
                container.classList.add('pool-enter');
            }
        },

        renderEmptyState(section) {
            const meta = SECTION_META[section];
            return `
                <div class="empty-state">
                    <span class="empty-icon" aria-hidden="true"><i class="fas ${meta.icon}"></i></span>
                    <p class="empty-title">${esc(meta.emptyTitle)}</p>
                    <p class="empty-text">${esc(meta.emptyText)}</p>
                    <button type="button" class="btn btn-primary btn-sm add-pool-item-btn" data-section="${section}"><i class="fas fa-plus" aria-hidden="true"></i> ${esc(meta.addLabel)}</button>
                </div>`;
        },

        renderLangBadges(item, section) {
            const main = SECTION_META[section].mainField;
            const badges = [['en', 'English'], ['es', 'Spanish']].map(([code, langName]) => {
                const detail = item.details?.find(d => d && d.language === code);
                const missing = !detail || !String(detail[main] || '').trim();
                return missing
                    ? `<span class="lang-badge is-missing" tabindex="0" data-tooltip="Missing ${langName}">${code.toUpperCase()}<span class="visually-hidden"> (${langName} missing)</span></span>`
                    : `<span class="lang-badge">${code.toUpperCase()}<span class="visually-hidden"> (${langName})</span></span>`;
            });
            return `<span class="lang-badges">${badges.join('')}</span>`;
        },

        renderContentPool(section) {
            const meta = SECTION_META[section];
            const container = this.elements.contentPoolContainer;
            const items = this.state.pools[section] || [];
            if (!items.length) {
                container.innerHTML = this.renderEmptyState(section);
                return;
            }

            const rows = items.map(item => ({ item, d: this.getPrimaryDetail(item, section) }));

            // Apply sorting
            const { field, direction } = this.state.sortConfig;
            if (field) {
                rows.sort((a, b) => {
                    const valA = String(field === 'primary' ? a.d.primary : a.d.secondary).toLowerCase();
                    const valB = String(field === 'primary' ? b.d.primary : b.d.secondary).toLowerCase();
                    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });
            }

            const version = this.currentVersion();
            const vName = version ? version.name : 'this version';
            const sortHead = (key, label) => {
                const sorted = field === key;
                const icon = sorted ? (direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort';
                const aria = sorted ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
                return `<th scope="col" class="col-${key}" aria-sort="${aria}"><button type="button" class="sort-btn sortable${sorted ? ' is-sorted' : ''}" data-sort="${key}">${esc(label)}<i class="fas ${icon}" aria-hidden="true"></i></button></th>`;
            };

            const head = `
                <thead><tr>
                    <th scope="col" class="col-visible">Show</th>
                    ${sortHead('primary', meta.primaryHead)}
                    ${meta.secondaryHead ? sortHead('secondary', meta.secondaryHead) : ''}
                    <th scope="col" class="col-lang">Languages</th>
                    <th scope="col" class="col-actions"><span class="visually-hidden">Actions</span></th>
                </tr></thead>`;

            const body = rows.map(({ item, d }) => {
                const isVisible = this.state.visibility[section].has(item.id);
                const label = esc(truncate(d.primaryPlain || meta.noun, 60));
                return `
                    <tr data-pool-id="${item.id}" data-section="${section}" class="${isVisible ? '' : 'is-off'}">
                        <td class="col-visible">
                            <label class="switch">
                                <input type="checkbox" class="visibility-toggle" role="switch" ${isVisible ? 'checked' : ''} ${version ? '' : 'disabled'} aria-label="Show “${label}” on ${esc(vName)}">
                                <span class="switch-track" aria-hidden="true"></span>
                            </label>
                        </td>
                        <td class="col-primary">${d.primaryHtml}${d.metaHtml}</td>
                        ${meta.secondaryHead ? `<td class="col-secondary">${d.secondaryHtml}</td>` : ''}
                        <td class="col-lang">${this.renderLangBadges(item, section)}</td>
                        <td class="col-actions">
                            <div class="row-actions">
                                <button type="button" class="btn-icon btn-icon-sm edit-pool-item-btn" aria-label="Edit “${label}”" data-tooltip="Edit"><i class="fas fa-pen" aria-hidden="true"></i></button>
                                <button type="button" class="btn-icon btn-icon-sm btn-icon-danger delete-pool-item-btn" aria-label="Delete “${label}”" data-tooltip="Delete"><i class="fas fa-trash-can" aria-hidden="true"></i></button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            container.innerHTML = `<div class="tbl-wrap"><table class="data-table" data-section="${section}">${head}<tbody>${body}</tbody></table></div>`;
        },

        // Display data for one pool row: sort keys + ready-to-insert HTML.
        getPrimaryDetail(item, section) {
            section = section || this.getActiveTab();
            const meta = SECTION_META[section] || SECTION_META.experience;
            const main = meta.mainField;
            const details = (item.details || []).filter(Boolean);
            const en = details.find(d => d.language === 'en');
            const es = details.find(d => d.language === 'es');
            const pick = (en && en[main]) ? en : ((es && es[main]) ? es : (en || details[0]));
            const text = pick ? String(pick[main] || '').trim() : '';

            const primaryHtml = text
                ? `<div class="cell-primary${section === 'summary' ? ' cell-clamp' : ''}">${esc(text)}</div>`
                : `<div class="cell-primary is-empty">Untitled</div>`;
            let secondary = '';
            let secondaryHtml = '';
            let metaHtml = '';

            if (section === 'experience' || section === 'education') {
                secondary = (section === 'experience' ? item.company : item.institution) || '';
                secondaryHtml = `<span class="cell-secondary">${esc(secondary)}</span>`;
                const range = this.formatRange(item.start_date, item.end_date);
                if (range) metaHtml = `<div class="cell-meta">${esc(range)}</div>`;
            } else if (section === 'project') {
                secondary = item.link || '';
                const shown = secondary.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                secondaryHtml = secondary ? `<span class="cell-secondary is-mono">${esc(truncate(shown, 48))}</span>` : '';
            } else if (section === 'skill') {
                const category = this.state.skillCategories.find(c => c.id === item.category_id);
                secondary = category ? category.name : '';
                secondaryHtml = secondary ? `<span class="cell-secondary">${esc(secondary)}</span>` : '<span class="cell-secondary">—</span>';
                if (item.percentage !== undefined && item.percentage !== null && item.percentage !== '') {
                    const pct = Math.max(0, Math.min(100, Number(item.percentage) || 0));
                    metaHtml = `<div class="cell-meta pct${pct >= 85 ? ' is-strong' : ''}"><span class="pct-bar" aria-hidden="true"><span style="transform:scaleX(${pct / 100})"></span></span>${pct}%</div>`;
                }
            }

            return { primary: text, secondary, primaryPlain: text, primaryHtml, secondaryHtml, metaHtml };
        },

        formatDateForInput(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date)) return '';
            return date.toISOString().split('T')[0];
        },

        formatMonth(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date)) return '';
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        },

        formatRange(start, end) {
            const s = this.formatMonth(start);
            const e = end ? this.formatMonth(end) : 'Present';
            if (!s && !end) return '';
            return `${s || '—'} – ${e}`;
        },

        // =====================================================================
        // Server info tab
        // =====================================================================
        async renderServerTab() {
            const container = this.elements.contentPoolContainer;
            const token = ++this._serverToken;
            container.innerHTML = this.skeletonHtml;
            const sections = this.state.serverSections || [];

            let lists = [];
            try {
                lists = await Promise.all(sections.map(s => this.apiGet(`/server-items/${s.id}`)));
            } catch (err) {
                if (token === this._serverToken) container.innerHTML = '<div class="empty-state"><p class="empty-title">Couldn’t load the server page</p><p class="empty-text">Check your connection and try again.</p></div>';
                return;
            }
            if (token !== this._serverToken || this.getActiveTab() !== 'server') return;
            this.state.serverItems = new Map(sections.map((s, i) => [s.id, lists[i] || []]));

            if (!sections.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon" aria-hidden="true"><i class="fas fa-server"></i></span>
                        <p class="empty-title">No server sections yet</p>
                        <p class="empty-text">Sections build the public server page: text, lists, grids, tables or a node overview.</p>
                        <button type="button" class="btn btn-primary btn-sm add-server-section-btn" id="add-server-section-btn"><i class="fas fa-plus" aria-hidden="true"></i> Add section</button>
                    </div>`;
                return;
            }
            container.innerHTML = `<div class="server-list">${sections.map(s => this.renderServerCard(s, this.state.serverItems.get(s.id))).join('')}</div>`;
        },

        renderServerCard(section, items) {
            const icon = safeIconClass(section.icon) || 'fas fa-server';
            const title = section.title || 'Untitled section';
            const hidden = section.is_visible === false;
            const itemRows = items.map(item => {
                const itemHidden = item.is_visible === false;
                const sub = [item.platform, item.function].filter(Boolean).join(' · ');
                return `
                    <tr data-item-id="${item.id}" class="${itemHidden ? 'is-off' : ''}">
                        <td class="col-type"><span class="mono-badge${item.item_type === 'service' ? ' is-accent' : ''}">${item.item_type === 'spec' ? 'Spec' : 'Service'}</span></td>
                        <td class="col-primary"><div class="cell-primary">${esc(item.title || 'Untitled')}${itemHidden ? ' <span class="mono-badge is-muted">Hidden</span>' : ''}</div>${item.content ? `<div class="cell-meta">${esc(truncate(item.content, 90))}</div>` : ''}</td>
                        <td class="col-secondary"><span class="cell-secondary">${esc(sub)}</span></td>
                        <td class="col-order">${esc(item.display_order ?? '')}</td>
                        <td class="col-actions">
                            <div class="row-actions">
                                <button type="button" class="btn-icon btn-icon-sm edit-item-btn" aria-label="Edit item “${esc(item.title)}”" data-tooltip="Edit"><i class="fas fa-pen" aria-hidden="true"></i></button>
                                <button type="button" class="btn-icon btn-icon-sm btn-icon-danger delete-item-btn" aria-label="Delete item “${esc(item.title)}”" data-tooltip="Delete"><i class="fas fa-trash-can" aria-hidden="true"></i></button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            return `
                <article class="server-card${hidden ? ' is-off' : ''}" data-section-id="${section.id}">
                    <header class="server-card-head">
                        <span class="server-icon" aria-hidden="true"><i class="${esc(icon)}"></i></span>
                        <div class="server-card-titles">
                            <h3 class="server-card-title">${esc(title)} <span class="mono-badge">${esc(LAYOUT_LABELS[section.layout_type] || section.layout_type || '—')}</span>${hidden ? '<span class="mono-badge is-muted">Hidden</span>' : ''}</h3>
                            ${section.description ? `<p class="server-card-desc">${esc(section.description)}</p>` : ''}
                        </div>
                        <div class="row-actions">
                            <button type="button" class="btn-icon btn-icon-sm edit-section-btn" aria-label="Edit section “${esc(title)}”" data-tooltip="Edit section"><i class="fas fa-pen" aria-hidden="true"></i></button>
                            <button type="button" class="btn-icon btn-icon-sm btn-icon-danger delete-section-btn" aria-label="Delete section “${esc(title)}”" data-tooltip="Delete section"><i class="fas fa-trash-can" aria-hidden="true"></i></button>
                        </div>
                    </header>
                    <div class="server-card-body">
                        <div class="server-items-head">
                            <span class="group-label">Items · ${items.length}</span>
                            <button type="button" class="btn btn-ghost btn-sm add-server-item-btn" data-section-id="${section.id}"><i class="fas fa-plus" aria-hidden="true"></i> Add item</button>
                        </div>
                        ${items.length ? `
                            <div class="tbl-wrap">
                                <table class="data-table server-items-table">
                                    <thead><tr>
                                        <th scope="col" class="col-type">Type</th>
                                        <th scope="col">Title</th>
                                        <th scope="col" class="col-secondary">Platform · Function</th>
                                        <th scope="col" class="col-order">Order</th>
                                        <th scope="col" class="col-actions"><span class="visually-hidden">Actions</span></th>
                                    </tr></thead>
                                    <tbody>${itemRows}</tbody>
                                </table>
                            </div>` : '<p class="server-items-empty">No items in this section yet.</p>'}
                    </div>
                </article>`;
        },

        async showServerModal(type, id = null, sectionId = null) {
            const isSection = type === 'server_section';
            let item = null;
            if (id) {
                if (isSection) {
                    item = this.state.serverSections.find(s => s.id === id) || null;
                } else {
                    const cached = this.state.serverItems.get(sectionId);
                    const list = cached || await this.apiGet(`/server-items/${sectionId}`);
                    item = list.find(i => i.id === id) || null;
                }
            }
            const parent = this.state.serverSections.find(s => s.id === (isSection ? id : sectionId));
            const siblings = isSection ? this.state.serverSections : (this.state.serverItems.get(sectionId) || []);
            const nextOrder = siblings.reduce((m, s) => Math.max(m, Number(s.display_order) || 0), 0) + 1;

            let html = `<input type="hidden" id="server-type" value="${type}">`;
            if (id) html += `<input type="hidden" id="server-id" value="${id}">`;
            if (sectionId) html += `<input type="hidden" id="server-section-id" value="${sectionId}">`;
            html += '<div class="form-grid">';

            Object.entries(this.formDefinitions[type]).forEach(([field, config]) => {
                const fid = `srv-${field}`;
                let value = item ? item[field] : '';
                if (!item && field === 'display_order') value = nextOrder;
                const label = esc(fieldLabel(field, type));
                const hint = fieldHint(field, type);
                const hintHtml = hint ? `<span class="field-hint">${esc(hint)}</span>` : '';

                if (typeof config === 'object' && config.type === 'select') {
                    html += `<label class="field"><span class="field-label">${label}</span><select name="${field}" id="${fid}">`;
                    config.options.forEach(opt => {
                        html += `<option value="${esc(opt.value)}" ${value == opt.value ? 'selected' : ''}>${esc(opt.label)}</option>`;
                    });
                    html += `</select></label>`;
                } else if (config === 'textarea') {
                    html += `<label class="field span-2"><span class="field-label">${label}</span><textarea name="${field}" id="${fid}" rows="3" data-autogrow>${esc(value || '')}</textarea></label>`;
                } else if (config === 'checkbox') {
                    const checked = item ? !!value : true;
                    html += `<div class="field"><span class="field-label" id="${fid}-label">${label}</span>
                        <label class="switch-field"><span class="switch"><input type="checkbox" role="switch" name="${field}" aria-labelledby="${fid}-label" ${checked ? 'checked' : ''}><span class="switch-track" aria-hidden="true"></span></span>Shown on the server page</label></div>`;
                } else if (field === 'icon') {
                    const iconCls = safeIconClass(value) || 'fas fa-icons';
                    html += `<label class="field"><span class="field-label">${label}</span>
                        <span class="input-affix has-icon"><span class="affix-icon" aria-hidden="true"><i class="${esc(iconCls)}"></i></span><input type="text" name="${field}" id="${fid}" value="${esc(value || '')}" placeholder="fas fa-server" spellcheck="false" data-icon-preview></span>${hintHtml}</label>`;
                } else {
                    html += `<label class="field"><span class="field-label">${label}</span><input type="${config}" name="${field}" id="${fid}" value="${esc(value ?? '')}" ${config === 'number' ? 'step="1"' : ''}>${hintHtml}</label>`;
                }
            });
            html += '</div>';

            const name = item?.title;
            const title = isSection
                ? (id ? (name ? truncate(name, 60) : 'Edit section') : 'New section')
                : (id ? (name ? truncate(name, 60) : 'Edit item') : 'New item');
            const eyebrow = isSection
                ? `Server page · ${id ? 'Edit section' : 'New section'}`
                : `Server page · ${parent ? truncate(parent.title, 40) : 'Item'}`;
            this.openDrawer({ eyebrow, title, html, onSave: () => this.handleServerSave() });
        },

        async handleServerSave() {
            if (this.drawerState?.saving) return;
            const form = this.elements.modalForm;
            const type = form.querySelector('#server-type').value;
            const id = form.querySelector('#server-id')?.value;
            const sectionId = form.querySelector('#server-section-id')?.value;
            const endpoint = type === 'server_section' ? 'server-sections' : 'server-items';

            const data = {};
            if (sectionId) data.section_id = parseInt(sectionId, 10);

            Object.keys(this.formDefinitions[type]).forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                if (input.type === 'checkbox') {
                    data[field] = input.checked;
                } else if (input.type === 'number') {
                    data[field] = parseInt(input.value, 10) || 0;
                } else {
                    data[field] = input.value;
                }
            });

            if (!String(data.title || '').trim()) {
                this.notify('Give it a title first.', 'error');
                form.querySelector('[name="title"]')?.focus();
                return;
            }

            this.drawerState.saving = true;
            const restore = this.setBusy(this.elements.modalSaveBtn, 'Saving…');
            try {
                const res = id ? await this.apiPut(`/${endpoint}/${id}`, data) : await this.apiPost(`/${endpoint}`, data);
                if (!res || res.error) throw new Error(res?.error || 'Save failed');
                this.closeDrawer();
                this.notify(type === 'server_section' ? 'Section saved.' : 'Item saved.');
                await this.loadServerSections();
                if (this.getActiveTab() === 'server') this.renderActiveTabContent();
            } catch (err) {
                this.notify(`Save failed: ${err.message}`, 'error');
            } finally {
                restore();
                if (this.drawerState) this.drawerState.saving = false;
            }
        },

        async handleDeleteServer(endpoint, id, sectionId) {
            const isSection = endpoint === 'server-sections';
            const target = isSection
                ? this.state.serverSections.find(s => s.id === id)
                : (this.state.serverItems.get(sectionId) || []).find(i => i.id === id);
            const name = target?.title ? `“${target.title}”` : (isSection ? 'This section' : 'This item');
            const ok = await this.confirmDialog(
                `${name} will be removed from the public server page. This can’t be undone.`,
                { title: isSection ? 'Delete section?' : 'Delete item?', confirmLabel: 'Delete', danger: true }
            );
            if (!ok) return;
            try {
                const res = await this.apiDelete(`/${endpoint}/${id}`);
                if (!res) return;
                if (!res.ok) {
                    const data = await this.parseResponse(res);
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                this.notify(isSection ? 'Section deleted.' : 'Item deleted.');
                await this.loadServerSections();
                this.renderActiveTabContent();
            } catch (err) {
                this.notify(`Delete failed: ${err.message}`, 'error');
            }
        },

        // =====================================================================
        // Event handlers
        // =====================================================================
        async handleVisibilityToggle(input, section) {
            const tr = input.closest('tr');
            const poolId = parseInt(tr.dataset.poolId, 10);
            const is_visible = input.checked;
            const versionId = this.state.currentVersionId;

            if (!versionId) {
                this.notify('Select a version first.', 'error');
                input.checked = !is_visible;
                return;
            }
            if (this.state.visibilityVersionId !== versionId) {
                this.notify('This version is still loading. Try again in a moment.', 'error');
                input.checked = !is_visible;
                return;
            }

            // Optimistic update; reverted if the server says no.
            const apply = (visible) => {
                tr.classList.toggle('is-off', !visible);
                this.state.visibility[section][visible ? 'add' : 'delete'](poolId);
                this.updateTabCounts();
            };
            apply(is_visible);

            try {
                const response = await fetch(`${API_BASE_URL}/visibility`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ version_id: versionId, section, pool_id: poolId, is_visible })
                });
                if (response.status === 401) { window.location.href = '/login'; return; }
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error (${response.status}): ${errorText}`);
                }
                const result = await response.json();
                if (!result.success) throw new Error('Update failed on server');
            } catch (error) {
                console.error('Error toggling visibility:', error);
                this.notify(`Failed to update visibility: ${error.message}`, 'error');
                input.checked = !is_visible;
                apply(!is_visible);
            }
        },

        setSettingsLang(lang) {
            const form = this.elements.settingsForm;
            form.querySelectorAll('.seg-btn').forEach(b => {
                const on = b.dataset.lang === lang;
                b.classList.toggle('is-on', on);
                b.setAttribute('aria-pressed', String(on));
            });
            form.querySelectorAll('[data-lang-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.langPane !== lang));
            form.querySelectorAll('[data-lang-input]').forEach(i => i.classList.toggle('hidden', i.dataset.langInput !== lang));
            store.set('settings-lang', lang);
        },

        async handleSettingsSave(e) {
            e.preventDefault();
            const versionId = this.state.currentVersionId;
            if (!versionId) return;
            if (this.state.settingsVersionId !== versionId) {
                this.notify('This version’s settings haven’t loaded yet. Try again in a moment.', 'error');
                return;
            }
            const versionData = {};

            // 1. Existing name and slug from state
            const currentVersion = this.currentVersion();
            if (currentVersion) {
                versionData.name = currentVersion.name;
                versionData.slug = currentVersion.slug;
            }

            // 2. Switches and titles from the form
            this.elements.settingsForm.querySelectorAll('[data-field]').forEach(el => {
                versionData[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value;
            });

            // 3. Version-specific subtitles via the contact_info endpoint
            const subtitleData = new FormData();
            const subtitleEl = document.getElementById('contact-subtitle');
            const subtitleEsEl = document.getElementById('contact-subtitle_es');
            if (subtitleEl) subtitleData.append('subtitle', subtitleEl.value);
            if (subtitleEsEl) subtitleData.append('subtitle_es', subtitleEsEl.value);

            const restore = this.setBusy(document.getElementById('settings-save-btn'), 'Saving…');
            try {
                const r1 = await this.apiPut(`/versions/${versionId}`, versionData);
                if (!r1 || r1.error) throw new Error(r1?.error || 'Version update failed');
                const r2 = await this.apiPutFormData(`/contact_info/${versionId}`, subtitleData);
                if (!r2 || r2.error) throw new Error(r2?.error || 'Subtitle update failed');
                this.notify('Version settings saved.');
            } catch (err) {
                console.error('Error saving settings:', err);
                this.notify(`Failed to save settings: ${err.message}`, 'error');
            } finally {
                restore();
            }

            await this.loadVersions();
            this.loadDataForCurrentVersion();
        },

        handleContentActionEvent(e) {
            const target = e.target;
            const activeTab = this.getActiveTab();

            if (activeTab === 'server') {
                const card = target.closest('.server-card');
                const sectionId = card ? parseInt(card.dataset.sectionId, 10) : null;
                const itemRow = target.closest('tr[data-item-id]');
                const itemId = itemRow ? parseInt(itemRow.dataset.itemId, 10) : null;
                if (target.closest('.add-server-section-btn')) this.showServerModal('server_section');
                else if (target.closest('.edit-section-btn')) this.showServerModal('server_section', sectionId);
                else if (target.closest('.delete-section-btn')) this.handleDeleteServer('server-sections', sectionId);
                else if (target.closest('.add-server-item-btn')) this.showServerModal('server_item', null, sectionId);
                else if (target.closest('.edit-item-btn')) this.showServerModal('server_item', itemId, sectionId);
                else if (target.closest('.delete-item-btn')) this.handleDeleteServer('server-items', itemId, sectionId);
                return;
            }

            const section = target.closest('[data-section]')?.dataset.section || activeTab;
            if (!section || !SECTION_META[section]) return;

            const sortBtn = target.closest('.sortable');
            if (sortBtn) {
                const field = sortBtn.dataset.sort;
                this.state.sortConfig.direction = (this.state.sortConfig.field === field && this.state.sortConfig.direction === 'asc') ? 'desc' : 'asc';
                this.state.sortConfig.field = field;
                this.renderContentPool(section);
                this.elements.contentPoolContainer.querySelector(`.sortable[data-sort="${field}"]`)?.focus();
                return;
            }
            if (target.closest('.add-pool-item-btn')) {
                this.showModal(section);
                return;
            }
            const tr = target.closest('tr[data-pool-id]');
            if (!tr) return;
            const poolId = parseInt(tr.dataset.poolId, 10);
            if (target.closest('.edit-pool-item-btn')) this.showModal(section, poolId);
            else if (target.closest('.delete-pool-item-btn')) this.handleDeletePoolItem(section, poolId);
        },

        async handleDeletePoolItem(section, poolId) {
            const meta = SECTION_META[section];
            const plural = section === 'summary' ? 'summaries' : section + 's';
            const item = this.state.pools[section].find(p => p.id === poolId);
            const label = item ? this.getPrimaryDetail(item, section).primaryPlain : '';
            const ok = await this.confirmDialog(
                `${label ? `“${truncate(label, 80)}”` : 'This item'} and its English and Spanish text will be permanently deleted from the library. Every version showing it will lose it.`,
                { title: `Delete this ${meta.noun}?`, confirmLabel: 'Delete', danger: true }
            );
            if (!ok) return;
            const res = await this.apiDelete(`/${plural}/${poolId}`);
            if (!res) return;
            if (!res.ok) {
                const data = await this.parseResponse(res);
                this.notify(`Delete failed: ${data?.error || res.status}`, 'error');
                return;
            }
            this.notify(`${capitalize(meta.noun)} deleted.`);
            await this.loadAllPools();
            this.updateTabCounts();
            this.renderActiveTabContent();
        },

        // =====================================================================
        // Drawer editor
        // =====================================================================
        showModal(section, poolId = null) {
            const meta = SECTION_META[section];
            const item = poolId ? this.state.pools[section].find(p => p.id === poolId) : null;
            const label = item ? this.getPrimaryDetail(item, section).primaryPlain : '';
            let title;
            if (section === 'summary') title = item ? 'Edit summary' : 'New summary';
            else title = item ? (label ? truncate(label, 64) : `Edit ${meta.noun}`) : `New ${meta.noun}`;
            const eyebrow = `${meta.label} · ${item ? 'Edit' : 'New'}`;
            this.openDrawer({
                eyebrow,
                title,
                html: this.generateFormHtml(section, item),
                onSave: () => this.handleSave(section, poolId),
            });
        },

        openDrawer({ eyebrow, title, html, onSave }) {
            const root = this.elements.modal;
            const alreadyOpen = this.layers.some(l => l.root === root);
            this.elements.modalEyebrow.textContent = eyebrow;
            this.elements.modalTitle.textContent = title;
            this.elements.modalForm.innerHTML = html;
            this.elements.modalForm.scrollTop = 0;
            this.drawerState = { onSave, snapshot: '', saving: false };
            this.bindDrawerFormBehaviors();
            this.showOverlay(root);
            this.drawerState.snapshot = this.serializeForm(this.elements.modalForm);
            if (!alreadyOpen) {
                this.pushLayer({
                    root,
                    panel: this.elements.modalPanel,
                    trap: true,
                    onEscape: () => this.requestCloseDrawer(),
                    onSave: () => this.saveDrawer(),
                });
            }
            this.elements.modalForm.querySelectorAll('textarea[data-autogrow]').forEach(ta => this.autoGrow(ta));
            const first = this.elements.modalForm.querySelector('input:not([type="hidden"]):not(:disabled):not([type="checkbox"]), select, textarea');
            (first || this.elements.modalPanel).focus({ preventScroll: true });
            if (first && /^(text|url|email|search|tel)$/.test(first.type)) {
                const end = first.value.length;
                first.setSelectionRange(end, end); // caret at the end, ready to edit
            }
        },

        bindDrawerFormBehaviors() {
            const form = this.elements.modalForm;
            // "Present" switch disables the end date
            const present = form.querySelector('[name="pool_end_date_present"]');
            const endDate = form.querySelector('[name="pool_end_date"]');
            if (present && endDate) {
                present.addEventListener('change', () => {
                    endDate.disabled = present.checked;
                    if (present.checked) endDate.value = '';
                    else endDate.focus();
                });
            }
            // "Add new category" option inside selects
            form.querySelectorAll('select').forEach(select => {
                select.dataset.oldValue = select.value;
                select.addEventListener('change', () => {
                    if (select.value === 'ADD_NEW') this.handleNewCategoryCreation(select);
                    else select.dataset.oldValue = select.value;
                });
            });
            // Live icon preview
            form.querySelectorAll('input[data-icon-preview]').forEach(input => {
                input.addEventListener('input', () => {
                    const i = input.parentElement.querySelector('.affix-icon i');
                    if (i) i.className = safeIconClass(input.value) || 'fas fa-icons';
                });
            });
            // Translation status in each language column
            form.querySelectorAll('.lang-col').forEach(col => {
                const mainInput = col.querySelector('[data-main-field]');
                const state = col.querySelector('.lang-state');
                if (!mainInput || !state) return;
                const sync = () => {
                    const missing = !mainInput.value.trim();
                    state.classList.toggle('is-missing', missing);
                    state.textContent = missing ? 'Not translated yet' : '';
                };
                mainInput.addEventListener('input', sync);
                sync();
            });
        },

        serializeForm(form) {
            return Array.from(form.elements)
                .filter(el => el.name)
                .map(el => `${el.name}=${el.type === 'checkbox' ? el.checked : el.value}`)
                .join('&');
        },

        isDrawerDirty() {
            if (!this.drawerState) return false;
            return this.serializeForm(this.elements.modalForm) !== this.drawerState.snapshot;
        },

        saveDrawer() {
            if (!this.drawerState || this.drawerState.saving) return;
            if (this.drawerState.onSave) this.drawerState.onSave();
        },

        async requestCloseDrawer() {
            const root = this.elements.modal;
            if (!root.classList.contains('is-open')) return;
            if (this.drawerState?.saving) return;
            if (this.isDrawerDirty()) {
                const ok = await this.confirmDialog('Your edits in this panel haven’t been saved.', {
                    title: 'Discard changes?', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true,
                });
                if (!ok) return;
            }
            this.closeDrawer();
        },

        closeDrawer() {
            const root = this.elements.modal;
            if (root.classList.contains('hidden')) return;
            this.popLayer(root);
            this.drawerState = null;
            this.hideOverlay(root, 320, () => { this.elements.modalForm.innerHTML = ''; });
        },

        // Kept for compatibility with older call sites.
        closeModal() { this.closeDrawer(); },

        async handleNewCategoryCreation(selectEl) {
            const name = await this.promptDialog('It becomes available to every skill.', {
                title: 'New skill category',
                placeholder: 'e.g. Cloud & DevOps',
                confirmLabel: 'Create category',
            });
            if (!name) {
                selectEl.value = selectEl.dataset.oldValue || '';
                return;
            }
            const existing = this.state.skillCategories.find(c => String(c.name).toLowerCase() === name.toLowerCase());
            if (existing) {
                selectEl.value = existing.id;
                selectEl.dataset.oldValue = String(existing.id);
                this.notify(`“${existing.name}” already exists — selected it.`);
                return;
            }
            try {
                const newCat = await this.apiPost('/skill_categories', { name });
                if (!newCat || newCat.error || newCat.id == null) throw new Error(newCat?.error || 'unknown error');
                const created = { ...newCat, name: newCat.name || name };
                this.state.skillCategories.push(created);

                // Add to dropdown (before the "add new" entry) and select it
                const option = new Option(created.name, created.id);
                selectEl.add(option, selectEl.querySelector('option[value="ADD_NEW"]'));
                selectEl.value = created.id;
                selectEl.dataset.oldValue = String(created.id);
                this.notify(`Category “${created.name}” created.`);
            } catch (err) {
                this.notify('Error creating category: ' + err.message, 'error');
                selectEl.value = selectEl.dataset.oldValue || '';
            }
        },

        generateFormHtml(section, item = null) {
            const definition = this.formDefinitions[section];
            const uid = `f${++this._formSeq}`;
            let html = '';

            // 1. Shared pool data
            const poolFields = Object.entries(definition.pool);
            if (poolFields.length) {
                html += '<section class="form-section"><h3 class="form-section-title">General · shared by both languages</h3><div class="form-grid">';
                for (const [field, typeInfo] of poolFields) {
                    html += this.poolFieldHtml(section, field, typeInfo, item, uid);
                }
                html += '</div></section>';
            }

            // 2. Language data (EN & ES)
            const enDetail = item?.details?.find(d => d && d.language === 'en') || { language: 'en' };
            const esDetail = item?.details?.find(d => d && d.language === 'es') || { language: 'es' };
            html += '<section class="form-section"><h3 class="form-section-title">Text · per language</h3><div class="lang-columns">';
            html += this.generateDetailSection(section, enDetail, 'English', 0, uid);
            html += this.generateDetailSection(section, esDetail, 'Español', 1, uid);
            html += '</div></section>';
            return html;
        },

        poolFieldHtml(section, field, typeInfo, item, uid) {
            const type = typeof typeInfo === 'string' ? typeInfo : typeInfo.type;
            const fid = `${uid}-${field}`;
            let value = item ? item[field] : '';
            if (type === 'date' && value) value = this.formatDateForInput(value);
            if (value === null || value === undefined) value = '';
            const label = esc(fieldLabel(field, section));
            const hint = fieldHint(field, section);
            const hintHtml = hint ? `<span class="field-hint">${esc(hint)}</span>` : '';

            if (type === 'select') {
                let options = [];
                if (field === 'category_id') {
                    options = this.state.skillCategories.map(c => ({ value: c.id, label: c.name }));
                } else {
                    options = typeInfo.options.map(opt => typeof opt === 'object' ? opt : { value: opt, label: opt });
                }
                let html = `<label class="field"><span class="field-label">${label}</span><select name="pool_${field}" id="${fid}">`;
                html += `<option value="">Choose…</option>`;
                options.forEach(opt => {
                    html += `<option value="${esc(opt.value)}" ${value == opt.value ? 'selected' : ''}>${esc(opt.label)}</option>`;
                });
                if (field === 'category_id') html += `<option value="ADD_NEW">＋ New category…</option>`;
                return html + `</select>${hintHtml}</label>`;
            }
            if (field === 'end_date') {
                const isPresent = !value;
                return `
                    <div class="field">
                        <label class="field-label" for="${fid}">${label}</label>
                        <div class="end-date-row">
                            <input type="date" id="${fid}" name="pool_end_date" value="${esc(value)}" ${isPresent ? 'disabled' : ''}>
                            <label class="present-toggle"><span class="switch"><input type="checkbox" role="switch" name="pool_end_date_present" ${isPresent ? 'checked' : ''}><span class="switch-track" aria-hidden="true"></span></span>Present</label>
                        </div>
                    </div>`;
            }
            if (field === 'percentage') {
                return `
                    <label class="field"><span class="field-label">${label}</span>
                        <span class="input-affix has-suffix"><input type="number" name="pool_percentage" id="${fid}" value="${esc(value)}" min="0" max="100" step="1" inputmode="numeric"><span class="affix-suffix" aria-hidden="true">%</span></span>
                        ${hintHtml}
                    </label>`;
            }
            const span = (field === 'company' || field === 'institution' || field === 'link') ? ' span-2' : '';
            const extra = type === 'url' ? ' spellcheck="false" placeholder="https://…"' : '';
            return `<label class="field${span}"><span class="field-label">${label}</span><input type="${type}" name="pool_${field}" id="${fid}" value="${esc(value)}"${extra}>${hintHtml}</label>`;
        },

        generateDetailSection(section, detail, title, index, uid) {
            const definition = this.formDefinitions[section].details;
            const code = index === 0 ? 'en' : 'es';
            const main = SECTION_META[section].mainField;
            let html = `<div class="lang-col" lang="${code}">
                <div class="lang-col-head"><span class="lang-tag lang-${code}">${code.toUpperCase()}</span>${esc(title)}<span class="lang-state"></span></div>`;
            html += `<input type="hidden" name="detail_${index}_id" value="${esc(detail?.id || '')}">`;
            html += `<input type="hidden" name="detail_${index}_language" value="${code}">`;

            for (const [field, type] of Object.entries(definition)) {
                if (field === 'language') continue; // handled by hidden input
                const value = detail ? (detail[field] || '') : '';
                const label = esc(fieldLabel(field, section));
                const hint = fieldHint(field, section);
                const hintHtml = hint ? `<span class="field-hint">${esc(hint)}</span>` : '';
                const mainAttr = field === main ? ' data-main-field' : '';
                if (type === 'textarea') {
                    const rows = field === 'content' ? 8 : 6;
                    html += `<label class="field"><span class="field-label">${label}</span><textarea name="detail_${index}_${field}" rows="${rows}" data-autogrow${mainAttr}>${esc(value)}</textarea>${hintHtml}</label>`;
                } else {
                    html += `<label class="field"><span class="field-label">${label}</span><input type="${type}" name="detail_${index}_${field}" value="${esc(value)}"${mainAttr}>${hintHtml}</label>`;
                }
            }
            return html + '</div>';
        },

        async handleSave(section, poolId) {
            if (this.drawerState?.saving) return;
            const form = this.elements.modalForm;
            const meta = SECTION_META[section];
            const poolData = {};
            const detailsData = [];

            // Collect pool data
            Object.keys(this.formDefinitions[section].pool).forEach(field => {
                if (field === 'end_date') {
                    const presentEl = form.querySelector('[name="pool_end_date_present"]');
                    if (presentEl && presentEl.checked) {
                        poolData[field] = null;
                        return;
                    }
                }
                const inputEl = form.querySelector(`[name="pool_${field}"]`);
                const typeInfo = this.formDefinitions[section].pool[field];
                const type = typeof typeInfo === 'string' ? typeInfo : typeInfo.type;
                let val = inputEl.value;
                if (val === 'ADD_NEW') val = '';
                poolData[field] = (val === '' && type !== 'text' && type !== 'url' && type !== 'textarea') ? null : val;
            });

            // Collect EN and ES details
            [0, 1].forEach(index => {
                const detail = { language: form.querySelector(`[name="detail_${index}_language"]`).value };
                const id = parseInt(form.querySelector(`[name="detail_${index}_id"]`).value, 10);
                if (id) detail.id = id;
                Object.keys(this.formDefinitions[section].details).forEach(field => {
                    if (field !== 'language') {
                        detail[field] = form.querySelector(`[name="detail_${index}_${field}"]`).value;
                    }
                });
                detailsData.push(detail);
            });

            if (!detailsData.some(d => String(d[meta.mainField] || '').trim())) {
                this.notify(`Add the ${fieldLabel(meta.mainField, section).toLowerCase()} in at least one language.`, 'error');
                form.querySelector('[data-main-field]')?.focus();
                return;
            }
            if (poolData.percentage !== undefined && poolData.percentage !== null) {
                const pct = Number(poolData.percentage);
                if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
                    this.notify('Proficiency must be between 0 and 100.', 'error');
                    form.querySelector('[name="pool_percentage"]')?.focus();
                    return;
                }
            }

            // A language left empty on a new entry isn't created, so the site doesn't show a blank item.
            const details = detailsData.filter(d => d.id || String(d[meta.mainField] || '').trim());
            const payload = { pool: poolData, details };
            const plural = section === 'summary' ? 'summaries' : section + 's';

            this.drawerState.saving = true;
            const restore = this.setBusy(this.elements.modalSaveBtn, 'Saving…');
            try {
                const res = poolId ? await this.apiPut(`/${plural}/${poolId}`, payload) : await this.apiPost(`/${plural}`, payload);
                if (!res || res.error) throw new Error(res?.error || 'Save failed');
                this.closeDrawer();
                this.notify(`${capitalize(meta.noun)} saved.`);
                await this.loadAllPools();
                this.updateTabCounts();
                this.renderActiveTabContent();
            } catch (err) {
                console.error('Save failed:', err);
                this.notify(`Save failed: ${err.message}`, 'error');
            } finally {
                restore();
                if (this.drawerState) this.drawerState.saving = false;
            }
        },

        // =====================================================================
        // AI Tailor wizard
        // =====================================================================
        escapeHtml(s) { return esc(s); },

        openTailorWizard() {
            // Populate base version dropdown from already-loaded state
            const select = document.getElementById('tailor-base-version');
            select.innerHTML = this.state.versions
                .map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
            if (this.state.currentVersionId) select.value = this.state.currentVersionId;

            // Reset fields
            document.getElementById('tailor-company').value = '';
            document.getElementById('tailor-jd').value = '';
            document.getElementById('tailor-notes').value = '';
            document.getElementById('tailor-include-cover-letter').checked = false;
            document.getElementById('tailor-cover-letter-section').classList.add('hidden');
            document.getElementById('tailor-generating').classList.add('hidden');
            this.state.tailorPreview = null;
            this.updateJdCount();

            const root = this.elements.tailorModal;
            this.showOverlay(root);
            this.tailorShowStep('input');
            if (!this.layers.some(l => l.root === root)) {
                this.pushLayer({ root, panel: root.querySelector('.modal'), trap: true, onEscape: () => this.requestCloseTailor() });
            }
            document.getElementById('tailor-jd').focus({ preventScroll: true });
        },

        async requestCloseTailor() {
            const onReview = !document.getElementById('tailor-step-preview').classList.contains('hidden');
            if (this.state.tailorBusy) {
                const ok = await this.confirmDialog('The AI is still working on this request. Closing discards the result.', {
                    title: 'Stop tailoring?', confirmLabel: 'Close anyway', cancelLabel: 'Keep waiting', danger: true,
                });
                if (!ok) return;
            } else if (onReview && this.state.tailorPreview) {
                const ok = await this.confirmDialog('This tailored draft hasn’t been saved as a version yet.', {
                    title: 'Discard this draft?', confirmLabel: 'Discard', cancelLabel: 'Keep reviewing', danger: true,
                });
                if (!ok) return;
            }
            this.closeTailorModal();
        },

        closeTailorModal() {
            const root = this.elements.tailorModal;
            this.state.tailorRun++; // ignore any in-flight generation
            if (this._tailorCleanup) { this._tailorCleanup(); this._tailorCleanup = null; }
            this.popLayer(root);
            this.hideOverlay(root, 320);
        },

        tailorShowStep(step) {
            ['input', 'preview'].forEach(s => {
                const el = document.getElementById(`tailor-step-${s}`);
                if (el) el.classList.toggle('hidden', s !== step);
            });
            document.querySelectorAll('#tailor-modal [data-step-actions]').forEach(group => {
                group.classList.toggle('hidden', group.dataset.stepActions !== step);
            });
            const stepper = document.getElementById('tailor-stepper');
            if (stepper) {
                stepper.classList.toggle('is-step-2', step === 'preview');
                stepper.querySelectorAll('.step').forEach(li => {
                    const current = li.dataset.step === step;
                    li.classList.toggle('is-current', current);
                    li.classList.toggle('is-done', step === 'preview' && li.dataset.step === 'input');
                    if (current) li.setAttribute('aria-current', 'step');
                    else li.removeAttribute('aria-current');
                });
            }
            const body = document.getElementById('tailor-body');
            if (body) body.scrollTop = 0;
            if (step === 'preview') {
                requestAnimationFrame(() => {
                    document.querySelectorAll('#tailor-step-preview textarea[data-autogrow]').forEach(ta => this.autoGrow(ta));
                });
            }
        },

        // Busy state with spinner + elapsed counter on the button and the generating overlay.
        // Returns a function that restores everything when called.
        tailorButtonBusy(btn, idleLabel, busyText = 'Generating…') {
            if (!btn) return () => {};
            const original = btn.innerHTML;
            btn.style.minWidth = `${btn.offsetWidth}px`;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            const start = Date.now();
            const fmt = (ms) => {
                const s = Math.floor(ms / 1000);
                return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
            };
            const elapsedEl = document.getElementById('tailor-elapsed');
            const render = () => {
                const t = fmt(Date.now() - start);
                btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${esc(busyText)} ${t}</span>`;
                if (elapsedEl) elapsedEl.textContent = t;
            };
            render();
            const timer = setInterval(render, 250);
            return () => {
                clearInterval(timer);
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerHTML = idleLabel || original;
                btn.style.minWidth = '';
            };
        },

        updateJdCount() {
            const jd = document.getElementById('tailor-jd');
            const out = document.getElementById('tailor-jd-count');
            if (!jd || !out) return;
            const n = jd.value.length;
            out.textContent = `${n.toLocaleString('en-US')} / 12,000`;
            out.classList.toggle('is-over', n > 12000);
        },

        updateTailorSkillCount() {
            const all = document.querySelectorAll('.tailor-skill-toggle');
            const on = Array.from(all).filter(cb => cb.checked).length;
            const out = document.getElementById('tailor-skills-count');
            if (out) out.textContent = all.length ? `${on} of ${all.length} selected` : '';
        },

        async tailorGenerate(isRegen) {
            const baseVersionId = parseInt(document.getElementById('tailor-base-version').value, 10);
            const language = document.getElementById('tailor-language').value;
            const company = document.getElementById('tailor-company').value.trim();
            const jd = document.getElementById('tailor-jd').value.trim();
            const notes = document.getElementById('tailor-notes').value.trim();

            if (!baseVersionId) { this.notify('Create a version first — the AI needs a base to start from.', 'error'); return; }
            if (!jd) {
                this.notify('Paste the job description first.', 'error');
                if (isRegen) this.tailorShowStep('input');
                document.getElementById('tailor-jd').focus();
                return;
            }
            if (jd.length > 12000) { this.notify('Job description too long (max 12,000 chars).', 'error'); return; }

            const run = ++this.state.tailorRun;
            const btn = document.getElementById(isRegen ? 'tailor-regenerate-btn' : 'tailor-generate-btn');
            const restoreBtn = this.tailorButtonBusy(btn, null, isRegen ? 'Regenerating…' : 'Generating…');
            const overlay = document.getElementById('tailor-generating');
            document.getElementById('tailor-generating-title').textContent = isRegen ? 'Regenerating with your notes' : 'Tailoring your resume';
            overlay.classList.remove('hidden');
            const lockIds = ['tailor-back-btn', 'tailor-commit-btn', 'tailor-generate-btn', 'tailor-regenerate-btn'];
            lockIds.forEach(id => { const b = document.getElementById(id); if (b && b !== btn) b.disabled = true; });
            this.state.tailorBusy = true;
            let cleaned = false;
            const cleanup = () => {
                if (cleaned) return;
                cleaned = true;
                this.state.tailorBusy = false;
                overlay.classList.add('hidden');
                lockIds.forEach(id => { const b = document.getElementById(id); if (b && b !== btn) b.disabled = false; });
                restoreBtn();
            };
            this._tailorCleanup = cleanup;

            try {
                const includeCoverLetter = document.getElementById('tailor-include-cover-letter').checked;
                const res = await this.apiPost('/tailor/preview', {
                    base_version_id: baseVersionId,
                    language,
                    job_description: jd,
                    company_name: company,
                    notes: isRegen ? notes : '',
                    include_cover_letter: includeCoverLetter,
                });
                if (run !== this.state.tailorRun) return; // closed meanwhile
                if (!res || res.error) {
                    this.notify('AI tailor failed: ' + (res?.error || 'unknown error'), 'error');
                    return;
                }
                this.state.tailorPreview = res;
                this.tailorRenderPreview(res);
                this.tailorShowStep('preview');
                this.notify('Tailored draft ready — review and edit before saving.');
            } catch (err) {
                if (run === this.state.tailorRun) this.notify('AI tailor failed: ' + err.message, 'error');
            } finally {
                if (run === this.state.tailorRun) cleanup();
            }
        },

        tailorRenderPreview(data) {
            const { suggestions, base_resume } = data;

            // Name + slug
            document.getElementById('tailor-new-name').value = suggestions.suggested_name || '';
            document.getElementById('tailor-new-slug').value = suggestions.suggested_slug || '';

            // Summary diff
            const summaryDiff = document.getElementById('tailor-summary-diff');
            const baseSummary = base_resume.summary;
            summaryDiff.innerHTML = `
                <div class="diff-original">
                    <span class="diff-label">Original</span>
                    <div class="diff-text${baseSummary ? '' : ' is-empty'}">${esc(baseSummary || 'No summary on the base version.')}</div>
                </div>
                <div class="diff-tailored">
                    <label class="diff-label" for="tailor-summary-edit"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Tailored</label>
                    <textarea id="tailor-summary-edit" data-autogrow>${esc(suggestions.summary || '')}</textarea>
                </div>`;

            // Experience list
            const expList = document.getElementById('tailor-experience-list');
            const byPoolId = new Map((suggestions.experience || []).map(e => [e.pool_id, e.description]));
            const experience = base_resume.experience || [];
            expList.innerHTML = experience.length ? experience.map(orig => {
                const tailored = byPoolId.get(orig.pool_id) || '';
                const tid = `tailor-exp-${orig.pool_id}`;
                return `
                    <div class="exp-card">
                        <div class="exp-card-header"><span class="exp-role">${esc(orig.role)}</span><span class="exp-company">${esc(orig.company)}</span></div>
                        <div class="diff-row">
                            <div class="diff-original">
                                <span class="diff-label">Original</span>
                                <div class="diff-text${orig.description ? '' : ' is-empty'}">${esc(orig.description || 'No description.')}</div>
                            </div>
                            <div class="diff-tailored">
                                <label class="diff-label" for="${tid}"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Tailored</label>
                                <textarea id="${tid}" data-pool-id="${orig.pool_id}" class="tailor-exp-edit" data-autogrow>${esc(tailored)}</textarea>
                            </div>
                        </div>
                    </div>`;
            }).join('') : '<p class="tailor-help">The base version doesn’t show any experience.</p>';

            // Skills (all skills the base version shows; AI's picks pre-checked), grouped by category
            const visible = new Set(suggestions.skills_visible || []);
            const skillsList = document.getElementById('tailor-skills-list');
            const groups = new Map();
            (base_resume.skills || []).forEach(s => {
                const key = s.category || 'Other';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(s);
            });
            skillsList.innerHTML = [...groups].map(([category, skills]) => `
                <div class="skill-group">
                    <p class="skill-group-label">${esc(category)}</p>
                    <div class="skill-chip-row">
                        ${skills.map(s => `
                            <label class="skill-chip">
                                <input type="checkbox" class="tailor-skill-toggle" data-pool-id="${s.id}" ${visible.has(s.id) ? 'checked' : ''}>
                                <span class="skill-chip-check" aria-hidden="true"><i class="fas fa-check"></i></span>${esc(s.name)}
                            </label>`).join('')}
                    </div>
                </div>`).join('') || '<p class="tailor-help">The base version doesn’t show any skills.</p>';
            this.updateTailorSkillCount();

            // AI's suggested NEW skills (opt-in: unchecked by default)
            const newSkills = suggestions.new_skills || [];
            const newHeading = document.getElementById('tailor-new-skills-heading');
            const newHelp = document.getElementById('tailor-new-skills-help');
            const newList = document.getElementById('tailor-new-skills-list');
            newHeading.classList.toggle('hidden', newSkills.length === 0);
            newHelp.classList.toggle('hidden', newSkills.length === 0);

            // Cover letter section — shown only when the LLM returned one
            const coverSection = document.getElementById('tailor-cover-letter-section');
            const coverTextarea = document.getElementById('tailor-cover-letter-text');
            if (suggestions.cover_letter && suggestions.cover_letter.trim()) {
                coverTextarea.value = suggestions.cover_letter;
                coverSection.classList.remove('hidden');
            } else {
                coverTextarea.value = '';
                coverSection.classList.add('hidden');
            }

            const categories = base_resume.all_categories || [];
            newList.innerHTML = newSkills.map((ns, i) => {
                const catOptions = categories.map(c =>
                    `<option value="${esc(c)}" ${String(c).toLowerCase() === (ns.category || '').toLowerCase() ? 'selected' : ''}>${esc(c)}</option>`
                ).join('');
                return `
                    <div class="new-skill-card" data-index="${i}">
                        <label class="new-skill-accept">
                            <input type="checkbox" class="tailor-new-skill-accept" data-index="${i}" aria-label="Accept ${esc(ns.name_en)}">
                            <span>Accept</span>
                        </label>
                        <div class="new-skill-fields">
                            <div class="new-skill-row">
                                <input type="text" class="tailor-new-skill-name-en" data-index="${i}" value="${esc(ns.name_en)}" placeholder="Name (EN)" aria-label="Name in English">
                                <input type="text" class="tailor-new-skill-name-es" data-index="${i}" value="${esc(ns.name_es)}" placeholder="Name (ES)" aria-label="Name in Spanish">
                                <select class="tailor-new-skill-category" data-index="${i}" aria-label="Category">${catOptions}</select>
                                <input type="number" class="tailor-new-skill-percentage" data-index="${i}" min="0" max="100" placeholder="%" aria-label="Proficiency (%)">
                            </div>
                            <div class="new-skill-evidence">${esc(ns.evidence || '')}</div>
                        </div>
                    </div>`;
            }).join('');
        },

        async tailorDownloadCoverLetter() {
            const preview = this.state.tailorPreview;
            if (!preview) { this.notify('No tailored content loaded.', 'error'); return; }

            const text = document.getElementById('tailor-cover-letter-text').value.trim();
            if (!text) { this.notify('Cover letter is empty.', 'error'); return; }

            // Slug comes from the review step — that's the URL the recipient will land on.
            const targetSlug = document.getElementById('tailor-new-slug').value.trim();
            const company = document.getElementById('tailor-company').value.trim();
            const language = document.getElementById('tailor-language').value;

            const btn = document.getElementById('tailor-download-cover-letter-btn');
            const restoreBtn = this.setBusy(btn, 'Rendering…');

            try {
                const response = await fetch(API_BASE_URL + '/tailor/cover-letter-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base_version_id: preview.base_version_id,
                        text,
                        company_name: company,
                        language,
                        target_slug: targetSlug,
                    }),
                });
                if (response.status === 401) { window.location.href = '/login'; return; }
                if (!response.ok) {
                    const errText = await response.text();
                    let msg = 'Cover letter PDF failed.';
                    try { msg = JSON.parse(errText).error || msg; } catch (_) { /* not JSON */ }
                    this.notify(msg, 'error');
                    return;
                }

                const blob = await response.blob();
                const cd = response.headers.get('content-disposition') || '';
                const match = cd.match(/filename="([^"]+)"/);
                const filename = match ? match[1] : 'cover-letter.pdf';

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                this.notify('Cover letter downloaded.');
            } catch (err) {
                this.notify('Cover letter PDF failed: ' + err.message, 'error');
            } finally {
                restoreBtn();
            }
        },

        async tailorCommit() {
            const preview = this.state.tailorPreview;
            if (!preview) { this.notify('No tailored content to save.', 'error'); return; }

            const nameInput = document.getElementById('tailor-new-name');
            const slugInput = document.getElementById('tailor-new-slug');
            const newName = nameInput.value.trim();
            const newSlug = slugInput.value.trim();
            if (!newName || !newSlug) {
                this.notify('Version name and slug are required.', 'error');
                (newName ? slugInput : nameInput).focus();
                return;
            }
            if (!/^[a-z0-9-]+$/.test(newSlug)) {
                this.notify('Slug may only contain lowercase letters, digits, and hyphens.', 'error');
                slugInput.focus();
                return;
            }

            // Edited experience descriptions
            const expEdits = Array.from(document.querySelectorAll('.tailor-exp-edit'))
                .filter(ta => ta.value.trim())
                .map(ta => ({
                    pool_id: parseInt(ta.dataset.poolId, 10),
                    description: ta.value,
                }));
            const summary = document.getElementById('tailor-summary-edit').value;
            const skillsVisible = Array.from(document.querySelectorAll('.tailor-skill-toggle'))
                .filter(cb => cb.checked).map(cb => parseInt(cb.dataset.poolId, 10));

            // Accepted new-skill suggestions (with the user's possibly-edited name/category/percentage)
            const newSkillsAccepted = Array.from(document.querySelectorAll('.tailor-new-skill-accept'))
                .filter(cb => cb.checked)
                .map(cb => {
                    const i = cb.dataset.index;
                    const pctRaw = document.querySelector(`.tailor-new-skill-percentage[data-index="${i}"]`).value.trim();
                    return {
                        name_en: document.querySelector(`.tailor-new-skill-name-en[data-index="${i}"]`).value.trim(),
                        name_es: document.querySelector(`.tailor-new-skill-name-es[data-index="${i}"]`).value.trim(),
                        category: document.querySelector(`.tailor-new-skill-category[data-index="${i}"]`).value,
                        percentage: pctRaw === '' ? null : parseInt(pctRaw, 10),
                    };
                })
                .filter(ns => ns.name_en && ns.name_es);

            const editedSuggestions = {
                experience: expEdits,
                summary,
                skills_visible: skillsVisible,
                new_skills_accepted: newSkillsAccepted,
                _meta: preview.suggestions._meta,
            };

            const language = document.getElementById('tailor-language').value;
            const company = document.getElementById('tailor-company').value.trim();
            const jd = document.getElementById('tailor-jd').value.trim();
            const notes = document.getElementById('tailor-notes').value.trim();

            const commitBtn = document.getElementById('tailor-commit-btn');
            const restore = this.setBusy(commitBtn, 'Saving…');
            try {
                const res = await this.apiPost('/tailor/commit', {
                    base_version_id: preview.base_version_id,
                    language,
                    new_name: newName,
                    new_slug: newSlug,
                    suggestions: editedSuggestions,
                    job_description: jd,
                    company_name: company,
                    notes,
                });
                if (!res || res.error) {
                    this.notify('Save failed: ' + this.friendlyError(res?.error, 'unknown error'), 'error');
                    return;
                }
                this.notify(`Tailored version “${newName}” created.`);
                this.state.tailorPreview = null;
                this.closeTailorModal();
                await this.loadVersions();
                if (res.id && this.findVersion(res.id)) await this.setActiveVersion(res.id);
                if (newSkillsAccepted.length) {
                    await this.loadAllPools();
                    this.updateTabCounts();
                    this.renderActiveTabContent();
                }
            } catch (err) {
                this.notify('Save failed: ' + err.message, 'error');
            } finally {
                restore();
            }
        },

        // =====================================================================
        // API helpers (apiGet wraps objects in arrays; 401 -> /login)
        // =====================================================================
        async parseResponse(response) {
            let data = null;
            try {
                const text = await response.text();
                data = text ? JSON.parse(text) : null;
            } catch (e) {
                data = null;
            }
            if (!response.ok) {
                if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
                if (!data.error) data.error = `Request failed (${response.status})`;
            }
            return data;
        },
        async apiGet(endpoint) {
            const response = await fetch(API_BASE_URL + endpoint);
            if (response.status === 401) {
                window.location.href = '/login';
                return [];
            }
            const data = await this.parseResponse(response);
            if (!response.ok) {
                this.notify(`API Error: ${data.error || 'Unknown error'}`, 'error');
                return [];
            }
            if (data == null) return [];
            return Array.isArray(data) ? data : [data];
        },
        async apiPost(endpoint, data) {
            const response = await fetch(API_BASE_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.status === 401) {
                window.location.href = '/login';
                return null;
            }
            return (await this.parseResponse(response)) ?? {};
        },
        async apiPut(endpoint, data) {
            const response = await fetch(API_BASE_URL + endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.status === 401) {
                window.location.href = '/login';
                return null;
            }
            return (await this.parseResponse(response)) ?? {};
        },
        async apiDelete(endpoint) {
            const response = await fetch(API_BASE_URL + endpoint, { method: 'DELETE' });
            if (response.status === 401) {
                window.location.href = '/login';
                return null;
            }
            return response;
        },
        async apiPutFormData(endpoint, formData) {
            const response = await fetch(API_BASE_URL + endpoint, { method: 'PUT', body: formData });
            if (response.status === 401) {
                window.location.href = '/login';
                return null;
            }
            return (await this.parseResponse(response)) ?? {};
        },
    };

    AdminApp.init();
});
