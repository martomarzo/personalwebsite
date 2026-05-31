document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle
    const themeBtn = document.getElementById('admin-theme-toggle');
    const updateThemeIcon = () => {
        const isLight = document.documentElement.classList.contains('light-mode');
        themeBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    };
    updateThemeIcon();
    themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('light-mode');
        const isLight = document.documentElement.classList.contains('light-mode');
        localStorage.setItem('theme-mode', isLight ? 'light' : 'dark');
        updateThemeIcon();
    });

    const API_BASE_URL = '/api/admin';

    const AdminApp = {
        state: {
            versions: [],
            currentVersionId: null,
            pools: { experience: [], education: [], project: [], skill: [], summary: [] },
            visibility: { experience: new Set(), education: new Set(), project: new Set(), skill: new Set(), summary: new Set() },
            skillCategories: [],
            serverSections: [],
            sortConfig: { field: null, direction: 'asc' }
        },

        notify(message, type = 'success') {
            let container = document.querySelector('.toast-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
            toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        elements: {
            versionsList: document.getElementById('versions-list'),
            addVersionBtn: document.getElementById('add-version-btn'),
            newVersionName: document.getElementById('new-version-name'),
            settingsManager: document.getElementById('version-settings-manager'),
            currentVersionNameSpan: document.getElementById('current-version-name'),
            settingsForm: document.getElementById('version-settings-form'),
            contentTabs: document.getElementById('tabs'),
            contentPoolContainer: document.getElementById('content-pool-container'),
            modal: document.getElementById('item-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalForm: document.getElementById('modal-form'),
            modalSaveBtn: document.getElementById('modal-save-btn'),
            modalCancelBtn: document.getElementById('modal-cancel-btn'),
        },

        // Defines the fields for each section's modal form
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
                    category_id: { type: 'select', options: [] }, // Will be filled dynamically
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
            this.bindEvents();
            await this.loadInitialData();
        },

        bindEvents() {
            this.elements.addVersionBtn.addEventListener('click', () => this.handleAddVersion());
            this.elements.contentTabs.addEventListener('click', (e) => this.handleTabClick(e));
            this.elements.settingsForm.addEventListener('submit', (e) => this.handleSettingsSave(e));
            this.elements.modalCancelBtn.addEventListener('click', () => this.closeModal());

            // AI Tailor wizard
            const tailorOpen = document.getElementById('tailor-open-btn');
            if (tailorOpen) tailorOpen.addEventListener('click', () => this.openTailorWizard());
            document.querySelectorAll('.tailor-close-btn').forEach(b => b.addEventListener('click', () => this.closeTailorModal()));
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

            const saveProfileBtn = document.getElementById('save-profile-btn');
            if (saveProfileBtn) saveProfileBtn.addEventListener('click', () => this.handleProfileSave());

            // Versions list: collapse toggle
            const collapseBtn = document.getElementById('versions-collapse-btn');
            const versionsBody = document.getElementById('versions-body');
            if (collapseBtn && versionsBody) {
                const collapsed = localStorage.getItem('versions-collapsed') === 'true';
                if (collapsed) {
                    versionsBody.classList.add('collapsed');
                    collapseBtn.querySelector('i').classList.replace('fa-chevron-up', 'fa-chevron-down');
                }
                collapseBtn.addEventListener('click', () => {
                    const isCollapsed = versionsBody.classList.toggle('collapsed');
                    collapseBtn.querySelector('i').classList.toggle('fa-chevron-up', !isCollapsed);
                    collapseBtn.querySelector('i').classList.toggle('fa-chevron-down', isCollapsed);
                    localStorage.setItem('versions-collapsed', isCollapsed);
                });
            }

            // Versions list: search filter
            const searchInput = document.getElementById('versions-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const q = searchInput.value.toLowerCase();
                    document.querySelectorAll('#versions-list li').forEach(li => {
                        const name = li.querySelector('.version-name')?.textContent.toLowerCase() || '';
                        li.style.display = name.includes(q) ? '' : 'none';
                    });
                });
            }

            const profilePicInput = document.getElementById('contact-profile-pic');
            if (profilePicInput) {
                profilePicInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const preview = document.getElementById('current-profile-pic-preview');
                        if (preview) preview.innerHTML = `<img src="${ev.target.result}" alt="New photo preview">`;
                    };
                    reader.readAsDataURL(file);
                });
            }

            // Logout listener
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.handleLogout());
            }

            // Delegated event listeners
            this.elements.contentPoolContainer.addEventListener('click', (e) => this.handleContentActionEvent(e));
            this.elements.versionsList.addEventListener('click', (e) => this.handleVersionAction(e));
        },

        async handleLogout() {
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.href = '/login';
                } catch (err) {
                    this.notify('Logout failed', 'error');
                }
            }
        },

        async loadInitialData() {
            await this.loadVersions();
            await this.loadGlobalProfile();
            await this.loadSkillCategories();
            await this.loadServerSections();
            if (this.state.versions.length > 0) {
                this.setActiveVersion(this.state.versions[0].id);
            }
            await this.loadAllPools();
            this.renderActiveTabContent();
        },

        async loadServerSections() {
            this.state.serverSections = await this.apiGet('/server-sections');
        },

        // --- Data Loading ---
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
            for (const section of Object.keys(this.state.pools)) {
                // Summary is an exception: plural is summaries, not summarys
                const plural = section === 'summary' ? 'summaries' : section + 's';
                this.state.pools[section] = await this.apiGet(`/${plural}`);
            }
        },
        async loadDataForCurrentVersion() {
            if (!this.state.currentVersionId) return;
            await this.loadVersionSettings();
            await this.loadVisibility();
            this.renderActiveTabContent();
        },
        async loadGlobalProfile() {
            try {
                const response = await fetch(`${API_BASE_URL}/global_profile`);
                if (!response.ok) return;
                const contactInfo = await response.json();
                if (!contactInfo) return;

                ['name', 'email', 'phone', 'linkedin', 'github', 'website'].forEach(key => {
                    const el = document.getElementById(`contact-${key}`);
                    if (el) el.value = contactInfo[key] || '';
                });
                const picHidden = document.getElementById('contact-profile_picture');
                if (picHidden) picHidden.value = contactInfo.profile_picture || '';
                this.updateProfilePreview(contactInfo.profile_picture);
            } catch (err) {
                // silently ignore — profile section just stays empty
            }
        },

        updateProfilePreview(url) {
            const picPreview = document.getElementById('current-profile-pic-preview');
            if (!picPreview) return;
            picPreview.innerHTML = url
                ? `<img src="${url}" alt="Profile Picture">`
                : '';
        },

        async handleProfileSave() {
            const formData = new FormData();
            ['name', 'email', 'phone', 'linkedin', 'github', 'website'].forEach(key => {
                const el = document.getElementById(`contact-${key}`);
                if (el) formData.append(key, el.value);
            });
            const picHidden = document.getElementById('contact-profile_picture');
            if (picHidden) formData.append('profile_picture', picHidden.value);
            const picFile = document.getElementById('contact-profile-pic');
            if (picFile && picFile.files[0]) formData.append('profile_pic', picFile.files[0]);

            try {
                const response = await fetch(`${API_BASE_URL}/global_profile`, { method: 'PUT', body: formData });
                if (!response.ok) throw new Error('Save failed');
                const result = await response.json();
                // Update hidden field and preview with whatever the server persisted
                if (result.profile_picture !== undefined) {
                    if (picHidden) picHidden.value = result.profile_picture || '';
                    this.updateProfilePreview(result.profile_picture);
                }
                this.notify('Profile saved!');
            } catch (err) {
                this.notify('Failed to save profile.', 'error');
            }
        },

        async loadVersionSettings() {
            const version = this.state.versions.find(v => v.id === this.state.currentVersionId);
            const contactInfoResponse = await this.apiGet(`/contact_info/${this.state.currentVersionId}`);
            const contactInfo = Array.isArray(contactInfoResponse) ? contactInfoResponse[0] : contactInfoResponse;

            this.elements.currentVersionNameSpan.textContent = `"${version.name}"`;
            this.elements.settingsForm.querySelectorAll('[data-field]').forEach(el => {
                const field = el.dataset.field;
                el[el.type === 'checkbox' ? 'checked' : 'value'] = version[field] || (el.type === 'checkbox' ? false : '');
            });

            // Populate version-specific subtitle fields
            if (contactInfo) {
                ['subtitle', 'subtitle_es'].forEach(key => {
                    const el = document.getElementById(`contact-${key}`);
                    if (el) el.value = contactInfo[key] || '';
                });
            }

            this.elements.settingsManager.classList.remove('hidden');
        },
        async loadVisibility() {
            if (!this.state.currentVersionId) return;
            for (const section of Object.keys(this.state.pools)) {
                try {
                    const visibleItems = await this.apiGet(`/visibility/${this.state.currentVersionId}/${section}`);
                    // Ensure visibleItems is an array before filtering
                    if (Array.isArray(visibleItems)) {
                        this.state.visibility[section] = new Set(visibleItems.filter(item => item.is_visible).map(item => item.pool_id));
                    } else {
                        this.state.visibility[section] = new Set();
                    }
                } catch (err) {
                    console.error(`Error loading visibility for ${section}:`, err);
                    this.state.visibility[section] = new Set();
                }
            }
        },

        // --- Rendering ---
        renderVersionsList() {
            this.elements.versionsList.innerHTML = '';
            this.state.versions.forEach(version => {
                const li = document.createElement('li');
                li.dataset.id = version.id;
                const publicUrl = `/?v=${encodeURIComponent(version.slug)}`;
                li.innerHTML = `
                    <div class="version-info">
                        <span class="version-name">${this.escapeHtml(version.name)}</span>
                        <a class="version-slug-link" href="${publicUrl}" target="_blank" rel="noopener" title="Open this version in a new tab">
                            <i class="fas fa-external-link-alt"></i> /${this.escapeHtml(version.slug)}
                        </a>
                    </div>
                    <span class="version-actions">
                        <i class="fas fa-file-pdf download-version-btn" title="Download as PDF"></i>
                        <i class="fas fa-copy duplicate-version-btn" title="Duplicate Version"></i>
                        <i class="fas fa-pencil-alt edit-version-btn" title="Rename version"></i>
                        <i class="fas fa-trash-alt delete-version-btn" title="Delete version"></i>
                    </span>
                `;
                this.elements.versionsList.appendChild(li);
            });
            // Re-apply active class after re-rendering
            const activeLi = this.elements.versionsList.querySelector(`li[data-id='${this.state.currentVersionId}']`);
            if (activeLi) activeLi.classList.add('active');
        },
        renderActiveTabContent() {
            const activeTab = this.elements.contentTabs.querySelector('.active');
            if (activeTab) {
                const tab = activeTab.dataset.tab;
                if (tab === 'server') {
                    this.renderServerTab();
                } else {
                    this.renderContentPool(tab);
                }
            }
        },

        async renderServerTab() {
            let html = `
                <div class="server-tab-header">
                    <h2>Server Info Management</h2>
                    <button class="btn-primary" id="add-server-section-btn">Add New Section</button>
                </div>
                <div class="server-sections-list">
            `;

            if (this.state.serverSections.length === 0) {
                html += '<p>No server sections found.</p>';
            } else {
                for (const section of this.state.serverSections) {
                    const items = await this.apiGet(`/server-items/${section.id}`);
                    html += `
                        <div class="server-section-card" data-section-id="${section.id}">
                            <div class="section-card-header">
                                <div class="section-info">
                                    <i class="${section.icon || 'fas fa-server'}"></i>
                                    <h3>${section.title}</h3>
                                    <span class="badge">${section.layout_type}</span>
                                </div>
                                <div class="section-actions">
                                    <button class="btn-icon edit-section-btn" title="Edit Section"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon delete-section-btn" title="Delete Section"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                            <div class="section-card-content">
                                <p>${section.description || 'No description'}</p>
                                <div class="section-items">
                                    <h4>Items</h4>
                                    <button class="btn-small add-server-item-btn" data-section-id="${section.id}">Add Item</button>
                                    <table class="small-table">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Title</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${items.map(item => `
                                                <tr data-item-id="${item.id}">
                                                    <td><span class="badge ${item.item_type}">${item.item_type}</span></td>
                                                    <td>${item.title}</td>
                                                    <td>
                                                        <button class="btn-icon edit-item-btn"><i class="fas fa-edit"></i></button>
                                                        <button class="btn-icon delete-item-btn"><i class="fas fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            html += '</div>';
            this.elements.contentPoolContainer.innerHTML = html;

            // Bind events for the new content
            document.getElementById('add-server-section-btn').addEventListener('click', () => this.showServerModal('server_section'));
            this.elements.contentPoolContainer.querySelectorAll('.edit-section-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.closest('.server-section-card').dataset.sectionId;
                    this.showServerModal('server_section', parseInt(id));
                });
            });
            this.elements.contentPoolContainer.querySelectorAll('.delete-section-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.closest('.server-section-card').dataset.sectionId;
                    this.handleDeleteServer('server-sections', parseInt(id));
                });
            });
            this.elements.contentPoolContainer.querySelectorAll('.add-server-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const sectionId = e.target.dataset.sectionId;
                    this.showServerModal('server_item', null, parseInt(sectionId));
                });
            });
            this.elements.contentPoolContainer.querySelectorAll('.edit-item-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const itemId = e.target.closest('tr').dataset.itemId;
                    const sectionId = e.target.closest('.server-section-card').dataset.sectionId;
                    this.showServerModal('server_item', parseInt(itemId), parseInt(sectionId));
                });
            });
            this.elements.contentPoolContainer.querySelectorAll('.delete-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const itemId = e.target.closest('tr').dataset.itemId;
                    this.handleDeleteServer('server-items', parseInt(itemId));
                });
            });
        },

        async showServerModal(type, id = null, sectionId = null) {
            this.elements.modalTitle.textContent = `${id ? 'Edit' : 'Add'} ${type.replace('_', ' ')}`;
            const item = id ? (type === 'server_section' ? 
                this.state.serverSections.find(s => s.id === id) : 
                (await this.apiGet(`/server-items/${sectionId}`)).find(i => i.id === id)) : null;

            let html = `<input type="hidden" id="server-type" value="${type}">`;
            if (id) html += `<input type="hidden" id="server-id" value="${id}">`;
            if (sectionId) html += `<input type="hidden" id="server-section-id" value="${sectionId}">`;

            Object.entries(this.formDefinitions[type]).forEach(([field, config]) => {
                const value = item ? item[field] : '';
                html += `<div class="form-group"><label>${field}</label>`;
                
                if (typeof config === 'object' && config.type === 'select') {
                    html += `<select name="${field}">`;
                    config.options.forEach(opt => {
                        html += `<option value="${opt.value}" ${value == opt.value ? 'selected' : ''}>${opt.label}</option>`;
                    });
                    html += `</select>`;
                } else if (config === 'textarea') {
                    html += `<textarea name="${field}">${value || ''}</textarea>`;
                } else if (config === 'checkbox') {
                    html += `<input type="checkbox" name="${field}" ${value ? 'checked' : ''}>`;
                } else {
                    html += `<input type="${config}" name="${field}" value="${value || ''}">`;
                }
                html += `</div>`;
            });

            this.elements.modalForm.innerHTML = html;
            this.elements.modal.classList.remove('hidden');

            // Replace save listener
            const newSaveBtn = this.elements.modalSaveBtn.cloneNode(true);
            this.elements.modalSaveBtn.replaceWith(newSaveBtn);
            this.elements.modalSaveBtn = newSaveBtn;
            this.elements.modalSaveBtn.addEventListener('click', () => this.handleServerSave());
        },

        async handleServerSave() {
            const form = this.elements.modalForm;
            const type = form.querySelector('#server-type').value;
            const id = form.querySelector('#server-id')?.value;
            const sectionId = form.querySelector('#server-section-id')?.value;
            const endpoint = type === 'server_section' ? 'server-sections' : 'server-items';

            const data = {};
            if (sectionId) data.section_id = parseInt(sectionId);
            
            Object.keys(this.formDefinitions[type]).forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                if (input.type === 'checkbox') {
                    data[field] = input.checked;
                } else if (input.type === 'number') {
                    data[field] = parseInt(input.value) || 0;
                } else {
                    data[field] = input.value;
                }
            });

            try {
                if (id) {
                    await this.apiPut(`/${endpoint}/${id}`, data);
                } else {
                    await this.apiPost(`/${endpoint}`, data);
                }
                this.closeModal();
                await this.loadServerSections();
                this.renderActiveTabContent();
            } catch (err) {
                this.notify('Save failed', 'error');
            }
        },

        async handleDeleteServer(endpoint, id) {
            if (confirm(`Are you sure you want to delete this ${endpoint.slice(0, -1)}?`)) {
                try {
                    await this.apiDelete(`/${endpoint}/${id}`);
                    await this.loadServerSections();
                    this.renderActiveTabContent();
                } catch (err) {
                    this.notify('Delete failed', 'error');
                }
            }
        },
        renderContentPool(section) {
            let html = `
                <button class="btn-primary add-pool-item-btn" data-section="${section}">Add New ${section}</button>
                <table>
                    <thead>
                        <tr>
                            <th>Visible</th>
                            <th class="sortable" data-sort="primary">Primary Info</th>
                            <th class="sortable" data-sort="secondary">Secondary Info</th>
                            <th>Languages</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            const poolData = [...this.state.pools[section]].map(item => ({
                ...item,
                _display: this.getPrimaryDetail(item)
            }));

            // Apply sorting
            if (this.state.sortConfig.field) {
                const { field, direction } = this.state.sortConfig;
                poolData.sort((a, b) => {
                    const valA = String(field === 'primary' ? a._display.primary : a._display.secondary).toLowerCase();
                    const valB = String(field === 'primary' ? b._display.primary : b._display.secondary).toLowerCase();
                    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });
            }

            poolData.forEach(item => {
                const isVisible = this.state.visibility[section].has(item.id);
                const details = item._display;
                const languages = item.details ? item.details.map(d => d.language).join(', ') : 'N/A';
                html += `
                    <tr data-pool-id="${item.id}" data-section="${section}">
                        <td><input type="checkbox" class="visibility-toggle" ${isVisible ? 'checked' : ''}></td>
                        <td>${details.primary}</td>
                        <td>${details.secondary}</td>
                        <td>${languages}</td>
                        <td>
                            <button class="btn-secondary edit-pool-item-btn">Edit</button>
                            <button class="btn-danger delete-pool-item-btn">Delete</button>
                        </td>
                    </tr>`;
            });
            this.elements.contentPoolContainer.innerHTML = html + `</tbody></table>`;
        },
        getPrimaryDetail(item) {
            const enDetail = item.details?.find(d => d.language === 'en') || item.details?.[0];
            if (!enDetail) return { primary: 'No Details', secondary: '' };
            if (enDetail.role) return { primary: enDetail.role, secondary: item.company };
            if (enDetail.degree) return { primary: enDetail.degree, secondary: item.institution };
            if (enDetail.name) {
                const secondary = item.percentage !== undefined ? `${item.percentage}%` : (item.link || '');
                const category = this.state.skillCategories.find(c => c.id === item.category_id);
                const categoryInfo = category ? `[${category.name}] ` : '';
                return { primary: enDetail.name, secondary: categoryInfo + secondary };
            }
            if (enDetail.content) return { primary: enDetail.content.substring(0, 50) + '...', secondary: '' };
            return { primary: `Item ${item.id}`, secondary: '' };
        },

        formatDateForInput(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
        },

        // --- Event Handlers ---
        handleVersionAction(e) {
            const target = e.target;
            const li = target.closest('li');
            if (!li) return;
            const id = parseInt(li.dataset.id);

            // If clicking the text or the LI itself, set active version
            if (target.classList.contains('version-name') || target === li) {
                this.setActiveVersion(id);
                return;
            }

            if (target.matches('.edit-version-btn')) {
                this.handleEditVersion(li, id);
            } else if (target.matches('.duplicate-version-btn')) {
                this.handleDuplicateVersion(id);
            } else if (target.matches('.delete-version-btn')) {
                this.handleDeleteVersion(id);
            } else if (target.matches('.download-version-btn')) {
                this.handleDownloadVersion(id, target);
            }
        },

        async handleDuplicateVersion(id) {
            if (confirm(`Do you want to create a complete copy of this resume version?`)) {
                try {
                    await this.apiPost(`/versions/duplicate/${id}`);
                    await this.loadVersions();
                    this.notify('Version duplicated successfully!');
                } catch (error) {
                    console.error('Error duplicating version:', error);
                    this.notify('Failed to duplicate version.', 'error');
                }
            }
        },

        async handleDeleteVersion(id) {
            if (confirm(`Are you sure you want to delete this version? This action cannot be undone.`)) {
                await this.apiDelete(`/versions/${id}`);
                // If we deleted the currently active version, reset the view
                if (id === this.state.currentVersionId) {
                    this.state.currentVersionId = null;
                    this.elements.settingsManager.classList.add('hidden');
                }
                await this.loadInitialData();
            }
        },

        handleDownloadVersion(id, anchorEl) {
            // Close any menu already open.
            document.querySelector('.lang-menu')?.remove();

            const menu = document.createElement('div');
            menu.className = 'lang-menu';
            menu.innerHTML = `
                <button type="button" data-lang="en">English</button>
                <button type="button" data-lang="es">Español</button>
            `;

            // Anchor the menu just below the clicked PDF icon.
            const rect = anchorEl.getBoundingClientRect();
            menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
            menu.style.left = `${rect.left + window.scrollX}px`;
            document.body.appendChild(menu);

            menu.addEventListener('click', (e) => {
                const lang = e.target.dataset.lang;
                if (!lang) return;
                window.open(`/api/download/pdf/${id}/${lang}`, '_blank');
                menu.remove();
            });

            // Dismiss on the next click anywhere else.
            setTimeout(() => {
                document.addEventListener('click', function close(ev) {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('click', close);
                    }
                });
            }, 0);
        },

        handleEditVersion(li, id) {
            const infoDiv = li.querySelector('.version-info');
            const nameSpan = li.querySelector('.version-name');
            const currentName = nameSpan.textContent;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            
            // Replace the entire info div with the input for editing
            li.insertBefore(input, li.firstChild);
            infoDiv.classList.add('hidden');
            input.focus();

            const save = async () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    // Create URL slug from name: "My CV" -> "my-cv"
                    const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    try {
                        await this.apiPut(`/versions/${id}`, { name: newName, slug: newSlug });
                        await this.loadVersions(); // Refresh all
                    } catch (error) {
                        this.notify('Failed to update version.', 'error');
                        input.remove();
                        infoDiv.classList.remove('hidden');
                    }
                } else {
                    input.remove();
                    infoDiv.classList.remove('hidden');
                }
            };
            
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') {
                    input.remove();
                    infoDiv.classList.remove('hidden');
                }
            });
        },

        setActiveVersion(id) {
            this.state.currentVersionId = id;
            this.elements.versionsList.querySelectorAll('li').forEach(li => li.classList.toggle('active', parseInt(li.dataset.id) === id));
            this.loadDataForCurrentVersion();
        },
        async handleAddVersion() {
            const name = this.elements.newVersionName.value.trim();
            if (name) {
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                await this.apiPost('/versions', { name, slug });
                this.elements.newVersionName.value = '';
                await this.loadVersions();
            }
        },
        handleTabClick(e) {
            if (e.target.matches('.tab-btn')) {
                this.elements.contentTabs.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                this.renderActiveTabContent();
            }
        },
        async handleVisibilityToggle(e, section) {
            const tr = e.target.closest('tr');
            const poolId = parseInt(tr.dataset.poolId);
            const is_visible = e.target.checked;
            
            if (!this.state.currentVersionId) {
                this.notify('Please select a version first!', 'error');
                e.target.checked = !is_visible;
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/visibility`, { 
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        version_id: this.state.currentVersionId, 
                        section, 
                        pool_id: poolId, 
                        is_visible 
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error (${response.status}): ${errorText}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    this.state.visibility[section][is_visible ? 'add' : 'delete'](poolId);
                } else {
                    throw new Error('Update failed on server');
                }
            } catch (error) {
                console.error('Error toggling visibility:', error);
                this.notify(`Failed to update visibility: ${error.message}`, 'error');
                e.target.checked = !is_visible; // Revert checkbox
            }
        },
        async handleSettingsSave(e) {
            e.preventDefault();
            const versionData = {};

            // 1. Get existing name and slug from state
            const currentVersion = this.state.versions.find(v => v.id === this.state.currentVersionId);
            if (currentVersion) {
                versionData.name = currentVersion.name;
                versionData.slug = currentVersion.slug;
            }

            // 2. Map checkboxes and titles from form
            this.elements.settingsForm.querySelectorAll('[data-field]').forEach(el => {
                versionData[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value;
            });

            // 3. Save version-specific subtitle fields via contact_info endpoint
            const subtitleData = new FormData();
            const subtitleEl = document.getElementById('contact-subtitle');
            const subtitleEsEl = document.getElementById('contact-subtitle_es');
            if (subtitleEl) subtitleData.append('subtitle', subtitleEl.value);
            if (subtitleEsEl) subtitleData.append('subtitle_es', subtitleEsEl.value);
            // Pass current global profile values so they aren't overwritten
            ['name', 'email', 'phone', 'linkedin', 'github', 'website'].forEach(key => {
                const el = document.getElementById(`contact-${key}`);
                if (el) subtitleData.append(key, el.value);
            });
            const picHidden = document.getElementById('contact-profile_picture');
            if (picHidden) subtitleData.append('profile_picture', picHidden.value);

            try {
                await this.apiPut(`/versions/${this.state.currentVersionId}`, versionData);
                await this.apiPutFormData(`/contact_info/${this.state.currentVersionId}`, subtitleData);
                this.notify('Version settings saved!');
            } catch (err) {
                console.error('Error saving settings:', err);
                this.notify('Failed to save settings. Check console for details.', 'error');
            }

            await this.loadVersions();
            this.loadDataForCurrentVersion();
        },
        handleContentActionEvent(e) {
            const target = e.target;
            const activeTab = this.elements.contentTabs.querySelector('.active')?.dataset.tab;
            const section = target.dataset.section || target.closest('tr')?.dataset.section || activeTab;
            if (!section) return;

            if (target.matches('.sortable')) {
                const field = target.dataset.sort;
                this.state.sortConfig.direction = (this.state.sortConfig.field === field && this.state.sortConfig.direction === 'asc') ? 'desc' : 'asc';
                this.state.sortConfig.field = field;
                this.renderContentPool(section);
            } else if (target.matches('.visibility-toggle')) {
                this.handleVisibilityToggle(e, section);
            } else if (target.matches('.add-pool-item-btn')) {
                this.showModal(section);
            } else if (target.matches('.edit-pool-item-btn')) {
                const tr = target.closest('tr');
                const poolId = parseInt(tr.dataset.poolId);
                this.showModal(section, poolId);
            } else if (target.matches('.delete-pool-item-btn')) {
                const tr = target.closest('tr');
                const poolId = parseInt(tr.dataset.poolId);
                this.handleDeletePoolItem(section, poolId);
            }
        },
        async handleDeletePoolItem(section, poolId) {
            const plural = section === 'summary' ? 'summaries' : section + 's';
            if (confirm(`Are you sure you want to permanently delete this ${section} item and all its translations?`)) {
                await this.apiDelete(`/${plural}/${poolId}`);
                await this.loadAllPools();
                this.renderActiveTabContent();
            }
        },

        // --- Modal & Form Logic ---
        showModal(section, poolId = null) {
            this.elements.modal.classList.remove('hidden');
            this.elements.modalTitle.textContent = `${poolId ? 'Edit' : 'Add'} ${section}`;
            
            const item = poolId ? this.state.pools[section].find(p => p.id === poolId) : null;
            this.elements.modalForm.innerHTML = this.generateFormHtml(section, item);
            
            // Handle "Add New..." in select dropdowns
            this.elements.modalForm.querySelectorAll('select').forEach(select => {
                select.addEventListener('change', (e) => {
                    if (e.target.value === 'ADD_NEW') {
                        this.handleNewCategoryCreation(e.target);
                    }
                });
            });

            this.elements.modalSaveBtn.onclick = () => this.handleSave(section, poolId);
        },
        async handleNewCategoryCreation(selectEl) {
            const name = prompt('Enter the new category name:');
            if (!name) {
                selectEl.value = selectEl.dataset.oldValue || '';
                return;
            }

            try {
                const newCat = await this.apiPost('/skill_categories', { name });
                this.state.skillCategories.push(newCat);
                
                // Add to dropdown and select it
                const option = new Option(newCat.name, newCat.id);
                selectEl.add(option, selectEl.options[selectEl.options.length - 1]);
                selectEl.value = newCat.id;
            } catch (err) {
                this.notify('Error creating category: ' + err.message, 'error');
                selectEl.value = '';
            }
        },
        closeModal() {
            this.elements.modal.classList.add('hidden');
            this.elements.modalForm.innerHTML = '';
        },
        generateFormHtml(section, item = null) {
            const definition = this.formDefinitions[section];
            let html = '<div class="admin-modal-sections">';
            
            // 1. Shared Pool Data
            html += '<section class="modal-pool-data"><h3>General Information</h3><div class="form-grid">';
            for (const [field, typeInfo] of Object.entries(definition.pool)) {
                let value = item ? item[field] : '';
                const type = typeof typeInfo === 'string' ? typeInfo : typeInfo.type;
                
                if (type === 'date' && value) {
                    value = this.formatDateForInput(value);
                }

                html += `<div class="form-group"><label>${field}</label>`;

                if (type === 'select') {
                    let options = [];
                    if (field === 'category_id') {
                        options = this.state.skillCategories.map(c => ({ value: c.id, label: c.name }));
                    } else {
                        options = typeInfo.options.map(opt => typeof opt === 'object' ? opt : { value: opt, label: opt });
                    }

                    html += `<select name="pool_${field}" data-old-value="${value}">`;
                    html += `<option value="">-- Select --</option>`;
                    options.forEach(opt => {
                        const selected = value == opt.value ? 'selected' : '';
                        html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    });
                    html += `<option value="ADD_NEW" style="font-weight: bold; color: var(--accent-color);">+ Add New Category...</option>`;
                    html += `</select>`;
                } else if (field === 'end_date') {
                    const isPresent = !value;
                    html += `<div class="end-date-group">`;
                    html += `<input type="date" name="pool_end_date" value="${value}" ${isPresent ? 'disabled' : ''}>`;
                    html += `<label class="still-active-label"><input type="checkbox" name="pool_end_date_present" ${isPresent ? 'checked' : ''} onchange="const d=this.closest('.end-date-group').querySelector('input[type=date]');d.disabled=this.checked;if(this.checked)d.value='';"> Present</label>`;
                    html += `</div>`;
                } else {
                    html += `<input type="${type}" name="pool_${field}" value="${value}">`;
                }
                html += `</div>`;
            }
            html += '</div></section><hr>';

            // 2. Language Data (EN & ES)
            html += '<div class="modal-languages-grid">';
            
            const enDetail = item?.details?.find(d => d.language === 'en') || { language: 'en' };
            const esDetail = item?.details?.find(d => d.language === 'es') || { language: 'es' };

            html += this.generateDetailSection(section, enDetail, 'English', 0);
            html += this.generateDetailSection(section, esDetail, 'Spanish (Español)', 1);

            html += '</div></div>';
            return html;
        },
        generateDetailSection(section, detail, title, index) {
            const definition = this.formDefinitions[section].details;
            let html = `<section class="modal-lang-section"><h3>${title}</h3>`;
            html += `<input type="hidden" name="detail_${index}_id" value="${detail?.id || ''}">`;
            html += `<input type="hidden" name="detail_${index}_language" value="${index === 0 ? 'en' : 'es'}">`;
            
            for (const [field, type] of Object.entries(definition)) {
                 if (field === 'language') continue; // Handled by hidden input
                 const value = detail ? (detail[field] || '') : '';
                 html += `<div class="form-group"><label>${field}</label>`;
                 if (type === 'textarea') {
                     html += `<textarea name="detail_${index}_${field}" rows="4">${value}</textarea>`;
                 } else {
                    html += `<input type="${type}" name="detail_${index}_${field}" value="${value}">`;
                 }
                 html += `</div>`;
            }
            return html + '</section>';
        },
        async handleSave(section, poolId) {
            const form = this.elements.modalForm;
            const poolData = {};
            const detailsData = [];
            
            // Collect Pool Data
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
                const val = inputEl.value;
                poolData[field] = (val === '' && type !== 'text' && type !== 'url' && type !== 'textarea') ? null : val;
            });

            // Collect EN and ES Details
            [0, 1].forEach(index => {
                const detail = { language: form.querySelector(`[name="detail_${index}_language"]`).value };
                const id = parseInt(form.querySelector(`[name="detail_${index}_id"]`).value);
                if (id) detail.id = id;

                Object.keys(this.formDefinitions[section].details).forEach(field => {
                    if (field !== 'language') {
                        detail[field] = form.querySelector(`[name="detail_${index}_${field}"]`).value;
                    }
                });
                detailsData.push(detail);
            });
            
            const payload = { pool: poolData, details: detailsData };
            const plural = section === 'summary' ? 'summaries' : section + 's';

            try {
                if (poolId) {
                    await this.apiPut(`/${plural}/${poolId}`, payload);
                } else {
                    await this.apiPost(`/${plural}`, payload);
                }
                this.closeModal();
                await this.loadAllPools();
                this.renderActiveTabContent();
            } catch (err) {
                console.error('Save failed:', err);
                this.notify('Save failed. Check console for details.', 'error');
            }
        },

        // --- API Helpers ---
        // --- AI Tailor Wizard ---
        escapeHtml(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
            ));
        },

        openTailorWizard() {
            // Populate base version dropdown from already-loaded state
            const select = document.getElementById('tailor-base-version');
            select.innerHTML = this.state.versions
                .map(v => `<option value="${v.id}">${this.escapeHtml(v.name)}</option>`).join('');
            if (this.state.currentVersionId) select.value = this.state.currentVersionId;

            // Reset fields
            document.getElementById('tailor-company').value = '';
            document.getElementById('tailor-jd').value = '';
            document.getElementById('tailor-notes').value = '';
            document.getElementById('tailor-include-cover-letter').checked = false;
            document.getElementById('tailor-cover-letter-section').classList.add('hidden');
            this.state.tailorPreview = null;

            document.getElementById('tailor-modal').classList.remove('hidden');
            this.tailorShowStep('input');
        },

        closeTailorModal() {
            document.getElementById('tailor-modal').classList.add('hidden');
        },

        tailorShowStep(step) {
            ['input', 'preview'].forEach(s => {
                const el = document.getElementById(`tailor-step-${s}`);
                if (el) el.classList.toggle('hidden', s !== step);
            });
        },

        // Put the active button into a busy state with a spinning icon and an elapsed counter.
        // Returns a function that restores the button when called.
        tailorButtonBusy(btn, idleLabel) {
            if (!btn) return () => {};
            btn.disabled = true;
            const start = Date.now();
            const render = () => {
                const s = Math.floor((Date.now() - start) / 1000);
                btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating… ${s}s`;
            };
            render();
            const timer = setInterval(render, 250);
            return () => {
                clearInterval(timer);
                btn.disabled = false;
                btn.innerHTML = idleLabel;
            };
        },

        async tailorGenerate(isRegen) {
            const baseVersionId = parseInt(document.getElementById('tailor-base-version').value, 10);
            const language = document.getElementById('tailor-language').value;
            const company = document.getElementById('tailor-company').value.trim();
            const jd = document.getElementById('tailor-jd').value.trim();
            const notes = document.getElementById('tailor-notes').value.trim();

            if (!jd) { this.notify('Paste the job description first.', 'error'); return; }
            if (jd.length > 12000) { this.notify('Job description too long (max 12,000 chars).', 'error'); return; }

            const btn = document.getElementById(isRegen ? 'tailor-regenerate-btn' : 'tailor-generate-btn');
            const restoreBtn = this.tailorButtonBusy(btn, isRegen ? 'Regenerate' : 'Generate');

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
                if (!res || res.error) {
                    this.notify('AI tailor failed: ' + (res?.error || 'unknown error'), 'error');
                    return;
                }
                this.state.tailorPreview = res;
                this.tailorRenderPreview(res);
                this.tailorShowStep('preview');
                this.notify('Tailored content ready — review and edit before saving.', 'success');
            } catch (err) {
                this.notify('AI tailor failed: ' + err.message, 'error');
            } finally {
                restoreBtn();
            }
        },

        tailorRenderPreview(data) {
            const { suggestions, base_resume } = data;

            // Name + slug
            document.getElementById('tailor-new-name').value = suggestions.suggested_name || '';
            document.getElementById('tailor-new-slug').value = suggestions.suggested_slug || '';

            // Summary diff
            const summaryDiff = document.getElementById('tailor-summary-diff');
            summaryDiff.innerHTML = `
                <div class="diff-original">
                    <label>Original</label>
                    <div class="diff-text">${this.escapeHtml(base_resume.summary || '(no summary on base version)')}</div>
                </div>
                <div class="diff-tailored">
                    <label>Tailored</label>
                    <textarea id="tailor-summary-edit">${this.escapeHtml(suggestions.summary || '')}</textarea>
                </div>
            `;

            // Experience list
            const expList = document.getElementById('tailor-experience-list');
            const byPoolId = new Map(suggestions.experience.map(e => [e.pool_id, e.description]));
            expList.innerHTML = base_resume.experience.map(orig => {
                const tailored = byPoolId.get(orig.pool_id) || '';
                return `
                    <div class="exp-card">
                        <div class="exp-card-header">${this.escapeHtml(orig.company)}<span class="role-company">${this.escapeHtml(orig.role)}</span></div>
                        <div class="diff-row">
                            <div class="diff-original">
                                <label>Original</label>
                                <div class="diff-text">${this.escapeHtml(orig.description || '')}</div>
                            </div>
                            <div class="diff-tailored">
                                <label>Tailored</label>
                                <textarea data-pool-id="${orig.pool_id}" class="tailor-exp-edit">${this.escapeHtml(tailored)}</textarea>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Skills checklist (all skills the base version shows; AI's picks pre-checked)
            const visible = new Set(suggestions.skills_visible || []);
            const skillsList = document.getElementById('tailor-skills-list');
            skillsList.innerHTML = base_resume.skills.map(s => `
                <label>
                    <input type="checkbox" class="tailor-skill-toggle" data-pool-id="${s.id}" ${visible.has(s.id) ? 'checked' : ''}>
                    ${this.escapeHtml(s.name)}
                    <small style="color:var(--text-light)">${this.escapeHtml(s.category || '')}</small>
                </label>
            `).join('');

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
                    `<option value="${this.escapeHtml(c)}" ${c.toLowerCase() === (ns.category || '').toLowerCase() ? 'selected' : ''}>${this.escapeHtml(c)}</option>`
                ).join('');
                return `
                    <div class="new-skill-card" data-index="${i}">
                        <label class="new-skill-accept">
                            <input type="checkbox" class="tailor-new-skill-accept" data-index="${i}">
                            <span>Accept</span>
                        </label>
                        <div class="new-skill-fields">
                            <div class="new-skill-row">
                                <input type="text" class="tailor-new-skill-name-en" data-index="${i}" value="${this.escapeHtml(ns.name_en)}" placeholder="Name (EN)">
                                <input type="text" class="tailor-new-skill-name-es" data-index="${i}" value="${this.escapeHtml(ns.name_es)}" placeholder="Name (ES)">
                                <select class="tailor-new-skill-category" data-index="${i}">${catOptions}</select>
                            </div>
                            <div class="new-skill-evidence">${this.escapeHtml(ns.evidence || '')}</div>
                        </div>
                    </div>
                `;
            }).join('');
        },

        async tailorDownloadCoverLetter() {
            const preview = this.state.tailorPreview;
            if (!preview) { this.notify('No tailored content loaded.', 'error'); return; }

            const text = document.getElementById('tailor-cover-letter-text').value.trim();
            if (!text) { this.notify('Cover letter is empty.', 'error'); return; }

            // Slug comes from the preview's version-name field — that's the URL the recipient will land on.
            const targetSlug = document.getElementById('tailor-new-slug').value.trim();
            const company = document.getElementById('tailor-company').value.trim();
            const language = document.getElementById('tailor-language').value;

            const btn = document.getElementById('tailor-download-cover-letter-btn');
            const restoreBtn = this.tailorButtonBusy(btn, '<i class="fas fa-download"></i> Download cover letter (PDF)');

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
                    try { msg = JSON.parse(errText).error || msg; } catch (_) {}
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
                this.notify('Cover letter downloaded.', 'success');
            } catch (err) {
                this.notify('Cover letter PDF failed: ' + err.message, 'error');
            } finally {
                restoreBtn();
            }
        },

        async tailorCommit() {
            const preview = this.state.tailorPreview;
            if (!preview) { this.notify('No tailored content to save.', 'error'); return; }

            const newName = document.getElementById('tailor-new-name').value.trim();
            const newSlug = document.getElementById('tailor-new-slug').value.trim();
            if (!newName || !newSlug) { this.notify('Version name and slug are required.', 'error'); return; }
            if (!/^[a-z0-9-]+$/.test(newSlug)) { this.notify('Slug may only contain lowercase letters, digits, and hyphens.', 'error'); return; }

            // Collect edited experience descriptions
            const expEdits = Array.from(document.querySelectorAll('.tailor-exp-edit')).map(ta => ({
                pool_id: parseInt(ta.dataset.poolId, 10),
                description: ta.value,
            }));
            const summary = document.getElementById('tailor-summary-edit').value;
            const skillsVisible = Array.from(document.querySelectorAll('.tailor-skill-toggle'))
                .filter(cb => cb.checked).map(cb => parseInt(cb.dataset.poolId, 10));

            // Collect accepted new-skill suggestions (with the user's possibly-edited name/category)
            const newSkillsAccepted = Array.from(document.querySelectorAll('.tailor-new-skill-accept'))
                .filter(cb => cb.checked)
                .map(cb => {
                    const i = cb.dataset.index;
                    return {
                        name_en: document.querySelector(`.tailor-new-skill-name-en[data-index="${i}"]`).value.trim(),
                        name_es: document.querySelector(`.tailor-new-skill-name-es[data-index="${i}"]`).value.trim(),
                        category: document.querySelector(`.tailor-new-skill-category[data-index="${i}"]`).value,
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
            commitBtn.disabled = true;
            commitBtn.textContent = 'Saving…';
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
                    this.notify('Save failed: ' + (res?.error || 'unknown'), 'error');
                    return;
                }
                this.notify('Tailored version created.', 'success');
                this.closeTailorModal();
                await this.loadVersions();
            } catch (err) {
                this.notify('Save failed: ' + err.message, 'error');
            } finally {
                commitBtn.disabled = false;
                commitBtn.textContent = 'Save as new version';
            }
        },

        async apiGet(endpoint) {
            const response = await fetch(API_BASE_URL + endpoint);
            if (response.status === 401) {
                window.location.href = '/login';
                return [];
            }
            const data = await response.json();
            if (!response.ok) {
                this.notify(`API Error: ${data.error || 'Unknown error'}`, 'error');
                return []; 
            }
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
            return response.json();
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
            return response.json();
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
            return response.json();
        },
    };

    AdminApp.init();
});
