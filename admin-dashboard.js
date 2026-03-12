document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api/admin';

    const AdminApp = {
        state: {
            versions: [],
            currentVersionId: null,
            pools: { experience: [], education: [], project: [], skill: [], summary: [] },
            visibility: { experience: new Set(), education: new Set(), project: new Set(), skill: new Set(), summary: new Set() },
            skillCategories: [],
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
            contentTabs: document.querySelector('.content-tabs'),
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
            
            // Delegated event listeners
            this.elements.contentPoolContainer.addEventListener('click', (e) => this.handleContentActionEvent(e));
            this.elements.versionsList.addEventListener('click', (e) => this.handleVersionAction(e));
        },

        async loadInitialData() {
            await this.loadVersions();
            await this.loadSkillCategories();
            if (this.state.versions.length > 0) {
                this.setActiveVersion(this.state.versions[0].id);
            }
            await this.loadAllPools();
            this.renderActiveTabContent();
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
        async loadVersionSettings() {
            const version = this.state.versions.find(v => v.id === this.state.currentVersionId);
            const contactInfo = await this.apiGet(`/contact_info/${this.state.currentVersionId}`);
            
            this.elements.currentVersionNameSpan.textContent = `"${version.name}"`;
            this.elements.settingsForm.querySelectorAll('[data-field]').forEach(el => {
                const field = el.dataset.field;
                el[el.type === 'checkbox' ? 'checked' : 'value'] = version[field] || (el.type === 'checkbox' ? false : '');
            });
            Object.keys(contactInfo).forEach(key => {
                const el = this.elements.settingsForm.querySelector(`#contact-${key}`);
                if (el) el.value = contactInfo[key] || '';
            });
            const picPreview = this.elements.settingsForm.querySelector('#current-profile-pic-preview');
            picPreview.innerHTML = contactInfo.profile_picture ? `<img src="${contactInfo.profile_picture}" alt="Profile Picture">` : '';
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
                li.innerHTML = `
                    <div class="version-info">
                        <span class="version-name">${version.name}</span>
                        <span class="version-slug">/${version.slug}</span>
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
                this.renderContentPool(activeTab.dataset.tab);
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
                this.handleDownloadVersion(id);
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

        handleDownloadVersion(id) {
            // Defaulting to 'en' for language. This could be made more dynamic in the future.
            const language = 'en'; 
            window.open(`/api/download/pdf/${id}/${language}`, '_blank');
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
            if (e.target.matches('.tab-link')) {
                this.elements.contentTabs.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                this.renderContentPool(e.target.dataset.tab);
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
            
            const contactData = new FormData(e.target); 
            
            try {
                await this.apiPut(`/versions/${this.state.currentVersionId}`, versionData);
                await this.apiPutFormData(`/contact_info/${this.state.currentVersionId}`, contactData);
                this.notify('Settings saved successfully!');
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
                poolData[field] = form.querySelector(`[name="pool_${field}"]`).value;
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
        async apiGet(endpoint) { 
            const response = await fetch(API_BASE_URL + endpoint);
            const data = await response.json();
            if (!response.ok) {
                this.notify(`API Error: ${data.error || 'Unknown error'}`, 'error');
                return []; // Return empty array to prevent code crashes
            }
            return Array.isArray(data) ? data : [data];
        },
        async apiPost(endpoint, data) { return (await fetch(API_BASE_URL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
        async apiPut(endpoint, data) { return (await fetch(API_BASE_URL + endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); },
        async apiDelete(endpoint) { return await fetch(API_BASE_URL + endpoint, { method: 'DELETE' }); },
        async apiPutFormData(endpoint, formData) { return (await fetch(API_BASE_URL + endpoint, { method: 'PUT', body: formData })).json(); },
    };

    AdminApp.init();
});
