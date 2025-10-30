document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';
    let currentAdminVersionId = null; // To store the currently selected version ID in admin panel

    const AdminApp = {
        init() {
            this.loadAllData();
            this.initEventListeners();
        },

        initEventListeners() {
            // Navigation scrolling
            document.querySelectorAll('header nav a').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetId = this.getAttribute('href');
                    document.querySelector(targetId).scrollIntoView({
                        behavior: 'smooth'
                    });
                });
            });

            // Resume Versions Form
            document.getElementById('resume-versions-form').addEventListener('submit', this.handleResumeVersionSubmit.bind(this));

            // Summary Form
            document.getElementById('summary-form').addEventListener('submit', this.handleSummarySubmit.bind(this));

            // Contact Info Form
            document.getElementById('contact-info-form').addEventListener('submit', this.handleContactInfoSubmit.bind(this));

            // Generic Add/Cancel buttons for sections
            document.querySelectorAll('.add-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const section = e.target.dataset.section;
                    this.showForm(section);
                    this.resetForm(section);
                    if (section !== 'resume-versions') {
                        const versionSelector = document.getElementById(`${section.replace('-', '')}-version-id`);
                        if (versionSelector) {
                            // Pre-select current admin version for new entries
                            versionSelector.value = currentAdminVersionId;
                        }
                    }
                });
            });

            document.querySelectorAll('.cancel-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const formContainer = e.target.closest('.form-container');
                    if (formContainer) {
                        formContainer.classList.add('hidden');
                    }
                });
            });

            // Specific form submissions
            document.getElementById('experience-form').addEventListener('submit', this.handleExperienceSubmit.bind(this));
            document.getElementById('education-form').addEventListener('submit', this.handleEducationSubmit.bind(this));
            document.getElementById('projects-form').addEventListener('submit', this.handleProjectSubmit.bind(this));
            document.getElementById('skills-form').addEventListener('submit', this.handleSkillSubmit.bind(this));

            // Main version selector for admin panel
            document.getElementById('main-version-selector').addEventListener('change', (event) => {
                currentAdminVersionId = event.target.value;
                this.loadAllData(); // Reload all data for the newly selected version
            });
        },

        async loadAllData() {
            const versions = await this.fetchAndRenderResumeVersions();
            if (versions.length > 0) {
                // Only set initial currentAdminVersionId if it's null (first load)
                if (currentAdminVersionId === null) {
                    const defaultVersion = versions.find(v => v.is_default) || versions[0];
                    currentAdminVersionId = defaultVersion ? defaultVersion.id : null;
                }
                this.populateVersionSelectors(versions, currentAdminVersionId);
            } else {
                currentAdminVersionId = null; // No versions, so no current version
            }

            // Always fetch global contact info
            await this.fetchAndRenderContactInfo();

            if (currentAdminVersionId) {
                await this.fetchAndRenderSummary(currentAdminVersionId);
                await this.fetchAndRenderExperience(currentAdminVersionId);
                await this.fetchAndRenderEducation(currentAdminVersionId);
                await this.fetchAndRenderProjects(currentAdminVersionId);
                await this.fetchAndRenderSkills(currentAdminVersionId);
            } else {
                // Clear all content if no version is selected
                this.renderExperienceTable([]);
                this.renderEducationTable([]);
                this.renderProjectsTable([]);
                this.renderSkillsTable([]);
                document.getElementById('summary-content').value = '';
                document.getElementById('summary-subtitle').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-phone').value = '';
                document.getElementById('contact-linkedin').value = '';
                document.getElementById('contact-github').value = '';
                document.getElementById('contact-instagram').value = '';
                document.getElementById('current-profile-pic-preview').innerHTML = '';
            }
        },

        // --- API Utility Functions ---
        async apiFetch(url) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        },

        async apiPost(url, data) {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        },

        async apiPut(url, data) {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        },

        async apiDelete(url) {
            const response = await fetch(url, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.status === 204; // No Content
        },

        // --- Form Management ---
        showForm(section) {
            document.getElementById(`${section}-form-container`).classList.remove('hidden');
        },

        hideForm(section) {
            document.getElementById(`${section}-form-container`).classList.add('hidden');
        },

        resetForm(section) {
            const form = document.getElementById(`${section}-form`);
            form.reset();
            const idField = form.querySelector(`input[type="hidden"][id$="-id"]`);
            if (idField) idField.value = ''; // Clear hidden ID for new entries
            if (section === 'contact-info') {
                document.getElementById('current-profile-pic-preview').innerHTML = '';
            }
        },

        // --- Resume Versions ---
        async fetchAndRenderResumeVersions() {
            try {
                const versions = await this.apiFetch(`${API_BASE_URL}/resume_versions`);
                this.renderResumeVersionsTable(versions);
                return versions;
            } catch (error) {
                console.error('Error fetching resume versions:', error);
                return [];
            }
        },

        renderResumeVersionsTable(versionsData) {
            const tableBody = document.querySelector('#resume-versions-table tbody');
            tableBody.innerHTML = '';
            versionsData.forEach(item => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${item.language}</td>
                    <td>${item.is_default ? 'Yes' : 'No'}</td>
                    <td class="action-buttons">
                        <button data-id="${item.id}" data-section="resume-versions" class="edit-button">Edit</button>
                        <button data-id="${item.id}" data-section="resume-versions" class="delete-button">Delete</button>
                    </td>
                `;
                row.querySelector('.edit-button').addEventListener('click', this.populateResumeVersionForm.bind(this, item));
                row.querySelector('.delete-button').addEventListener('click', this.handleDelete.bind(this, item.id, 'resume_versions'));
            });
        },

        populateResumeVersionForm(item) {
            this.showForm('resume-versions');
            document.getElementById('version-id').value = item.id;
            document.getElementById('version-name').value = item.name;
            document.getElementById('version-language').value = item.language;
            document.getElementById('version-is-default').checked = item.is_default;

            // Populate title fields
            document.getElementById('version-title-summary').value = item.title_professional_summary || '';
            document.getElementById('version-title-experience').value = item.title_professional_experience || '';
            document.getElementById('version-title-skills').value = item.title_technical_skills || '';
            document.getElementById('version-title-projects').value = item.title_personal_projects || '';
            document.getElementById('version-title-education').value = item.title_education || '';
            document.getElementById('version-title-languages').value = item.title_languages || '';

            // Populate show flags
            document.getElementById('version-show-summary').checked = item.show_professional_summary;
            document.getElementById('version-show-experience').checked = item.show_professional_experience;
            document.getElementById('version-show-skills').checked = item.show_technical_skills;
            document.getElementById('version-show-projects').checked = item.show_personal_projects;
            document.getElementById('version-show-education').checked = item.show_education;
            document.getElementById('version-show-languages').checked = item.show_languages;
        },

        async handleResumeVersionSubmit(event) {
            event.preventDefault();
            const id = document.getElementById('version-id').value;
            const data = {
                name: document.getElementById('version-name').value,
                language: document.getElementById('version-language').value,
                is_default: document.getElementById('version-is-default').checked,
                // Title fields
                title_professional_summary: document.getElementById('version-title-summary').value,
                title_professional_experience: document.getElementById('version-title-experience').value,
                title_technical_skills: document.getElementById('version-title-skills').value,
                title_personal_projects: document.getElementById('version-title-projects').value,
                title_education: document.getElementById('version-title-education').value,
                title_languages: document.getElementById('version-title-languages').value,
                // Show flags
                show_professional_summary: document.getElementById('version-show-summary').checked,
                show_professional_experience: document.getElementById('version-show-experience').checked,
                show_technical_skills: document.getElementById('version-show-skills').checked,
                show_personal_projects: document.getElementById('version-show-projects').checked,
                show_education: document.getElementById('version-show-education').checked,
                show_languages: document.getElementById('version-show-languages').checked,
            };

            try {
                if (id) {
                    await this.apiPut(`${API_BASE_URL}/resume_versions/${id}`, data);
                    alert('Resume version updated successfully!');
                } else {
                    await this.apiPost(`${API_BASE_URL}/resume_versions`, data);
                    alert('Resume version added successfully!');
                }
                this.hideForm('resume-versions');
                this.loadAllData();
            } catch (error) {
                console.error('Error saving resume version:', error);
                alert('Failed to save resume version.');
            }
        },

        populateVersionSelectors(versions, selectedId = null) {
            const selectors = document.querySelectorAll('select[id$="-version-id"]:not(#summary-version-id), #main-version-selector'); // Exclude summary-version-id
            selectors.forEach(selector => {
                selector.innerHTML = ''; // Clear existing options
                versions.forEach(version => {
                    const option = document.createElement('option');
                    option.value = version.id;
                    option.textContent = `${version.name} (${version.language})`;
                    selector.appendChild(option);
                });
                if (selectedId) {
                    selector.value = selectedId;
                }
            });
        },

        // --- Summary ---
        async fetchAndRenderSummary(versionId) {
            try {
                const summary = await this.apiFetch(`${API_BASE_URL}/summary?versionId=${versionId}`);
                document.getElementById('summary-content').value = summary.content || '';
                document.getElementById('summary-subtitle').value = summary.subtitle || ''; // New subtitle field
                // document.getElementById('summary-version-id').value = versionId; // Removed as element no longer exists
            } catch (error) {
                console.error('Error fetching summary:', error);
                document.getElementById('summary-content').value = ''; // Clear if not found
                document.getElementById('summary-subtitle').value = ''; // Clear if not found
                // If 404, it means no summary exists, form will remain empty
            }
        },

        async handleSummarySubmit(event) {
            event.preventDefault();
            const version_id = currentAdminVersionId; // Use the currently selected admin version ID
            const content = document.getElementById('summary-content').value;
            const subtitle = document.getElementById('summary-subtitle').value; // New subtitle field
            try {
                // Call PUT /api/summary (without ID in URL) for upsert based on version_id
                await this.apiPut(`${API_BASE_URL}/summary`, { content, subtitle, version_id }); // Added subtitle
                alert('Summary updated successfully!');
            } catch (error) {
                console.error('Error updating summary:', error);
                alert('Failed to update summary.');
            }
        },

        // --- Contact Info ---
        async fetchAndRenderContactInfo() { // No longer accepts versionId
            try {
                const contactInfo = await this.apiFetch(`${API_BASE_URL}/contact_info`);
                document.getElementById('contact-email').value = contactInfo.email || '';
                document.getElementById('contact-phone').value = contactInfo.phone || '';
                document.getElementById('contact-linkedin').value = contactInfo.linkedin_url || '';
                document.getElementById('contact-github').value = contactInfo.github_url || '';
                document.getElementById('contact-instagram').value = contactInfo.instagram_url || '';
                // Subtitle and version_id are no longer part of contact_info

                const profilePicPreview = document.getElementById('current-profile-pic-preview');
                profilePicPreview.innerHTML = ''; // Clear previous preview
                if (contactInfo.profile_pic_url) {
                    const img = document.createElement('img');
                    img.src = contactInfo.profile_pic_url;
                    img.style.maxWidth = '100px';
                    img.style.maxHeight = '100px';
                    img.style.marginTop = '10px';
                    profilePicPreview.appendChild(img);
                }
                // Clear the file input field after fetching data
                document.getElementById('contact-profile-pic').value = '';

            } catch (error) {
                console.error('Error fetching contact info:', error);
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-phone').value = '';
                document.getElementById('contact-linkedin').value = '';
                document.getElementById('contact-github').value = '';
                document.getElementById('contact-instagram').value = '';
                document.getElementById('current-profile-pic-preview').innerHTML = '';
                // If 404, it means no contact info exists, form will remain empty
            }
        },

        async handleContactInfoSubmit(event) {
            event.preventDefault();
            const id = 1; // Assuming contact_info always has ID 1

            const formData = new FormData();
            formData.append('email', document.getElementById('contact-email').value);
            formData.append('phone', document.getElementById('contact-phone').value);
            formData.append('linkedin_url', document.getElementById('contact-linkedin').value);
            formData.append('github_url', document.getElementById('contact-github').value);
            formData.append('instagram_url', document.getElementById('contact-instagram').value);
            // Subtitle and version_id are no longer part of contact_info

            const profilePicFile = document.getElementById('contact-profile-pic').files[0];
            if (profilePicFile) {
                formData.append('profile_pic', profilePicFile);
            }

            try {
                const response = await fetch(`${API_BASE_URL}/contact_info/${id}`, {
                    method: 'PUT',
                    body: formData, // FormData is sent directly, no JSON.stringify
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                alert('Contact information updated successfully!');
                this.fetchAndRenderContactInfo(); // Re-fetch to update preview
                // Reload frontend content to reflect changes immediately
                if (window.app && typeof window.app.loadPortfolioContent === 'function') {
                    window.app.loadPortfolioContent(); // No versionId needed for global contact info
                }
            } catch (error) {
                console.error('Error updating contact info:', error);
                alert('Failed to update contact information.');
            }
        },

        // --- Experience ---
        async fetchAndRenderExperience(versionId) {
            try {
                const experience = await this.apiFetch(`${API_BASE_URL}/experience?versionId=${versionId}`);
                this.renderExperienceTable(experience);
            } catch (error) {
                console.error('Error fetching experience:', error);
            }
        },

        renderExperienceTable(experienceData) {
            const tableBody = document.querySelector('#experience-table tbody');
            tableBody.innerHTML = ''; // Clear existing rows
            experienceData.forEach(item => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${item.version_id}</td>
                    <td>${item.title}</td>
                    <td>${item.company}</td>
                    <td>${item.location || ''}</td>
                    <td>${item.start_date}</td>
                    <td>${item.end_date || 'Present'}</td>
                    <td class="action-buttons">
                        <button data-id="${item.id}" data-section="experience" class="edit-button">Edit</button>
                        <button data-id="${item.id}" data-section="experience" class="delete-button">Delete</button>
                    </td>
                `;
                row.querySelector('.edit-button').addEventListener('click', this.populateExperienceForm.bind(this, item));
                row.querySelector('.delete-button').addEventListener('click', this.handleDelete.bind(this, item.id, 'experience', item.version_id));
            });
        },

        populateExperienceForm(item) {
            this.showForm('experience');
            document.getElementById('experience-id').value = item.id;
            document.getElementById('exp-version-id').value = item.version_id;
            document.getElementById('exp-title').value = item.title;
            document.getElementById('exp-company').value = item.company;
            document.getElementById('exp-location').value = item.location;
            document.getElementById('exp-start-date').value = this.formatDateToInput(item.start_date);
            document.getElementById('exp-end-date').value = this.formatDateToInput(item.end_date);
            document.getElementById('exp-description').value = item.description;
            document.getElementById('exp-contact-person').value = item.contact_person;
            document.getElementById('exp-contact-email').value = item.contact_email;
        },

        async handleExperienceSubmit(event) {
            event.preventDefault();
            const id = document.getElementById('experience-id').value;
            const data = {
                version_id: document.getElementById('exp-version-id').value,
                title: document.getElementById('exp-title').value,
                company: document.getElementById('exp-company').value,
                location: document.getElementById('exp-location').value,
                start_date: document.getElementById('exp-start-date').value,
                end_date: document.getElementById('exp-end-date').value,
                description: document.getElementById('exp-description').value,
                contact_person: document.getElementById('exp-contact-person').value,
                contact_email: document.getElementById('exp-contact-email').value,
            };

            try {
                if (id) {
                    await this.apiPut(`${API_BASE_URL}/experience/${id}`, data);
                    alert('Experience updated successfully!');
                } else {
                    await this.apiPost(`${API_BASE_URL}/experience`, data);
                    alert('Experience added successfully!');
                }
                this.hideForm('experience');
                this.loadAllData();
            } catch (error) {
                console.error('Error saving experience:', error);
                alert('Failed to save experience.');
            }
        },

        // --- Education ---
        async fetchAndRenderEducation(versionId) {
            try {
                const education = await this.apiFetch(`${API_BASE_URL}/education?versionId=${versionId}`);
                this.renderEducationTable(education);
            } catch (error) {
                console.error('Error fetching education:', error);
            }
        },

        renderEducationTable(educationData) {
            const tableBody = document.querySelector('#education-table tbody');
            tableBody.innerHTML = '';
            educationData.forEach(item => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${item.version_id}</td>
                    <td>${item.degree}</td>
                    <td>${item.institution}</td>
                    <td>${item.start_date}</td>
                    <td>${item.end_date || 'Ongoing'}</td>
                    <td class="action-buttons">
                        <button data-id="${item.id}" data-section="education" class="edit-button">Edit</button>
                        <button data-id="${item.id}" data-section="education" class="delete-button">Delete</button>
                    </td>
                `;
                row.querySelector('.edit-button').addEventListener('click', this.populateEducationForm.bind(this, item));
                row.querySelector('.delete-button').addEventListener('click', this.handleDelete.bind(this, item.id, 'education', item.version_id));
            });
        },

        populateEducationForm(item) {
            this.showForm('education');
            document.getElementById('edu-id').value = item.id;
            document.getElementById('edu-version-id').value = item.version_id;
            document.getElementById('edu-degree').value = item.degree;
            document.getElementById('edu-institution').value = item.institution;
            document.getElementById('edu-start-date').value = this.formatDateToInput(item.start_date);
            document.getElementById('edu-end-date').value = this.formatDateToInput(item.end_date);
            document.getElementById('edu-description').value = item.description;
        },

        async handleEducationSubmit(event) {
            event.preventDefault();
            const id = document.getElementById('edu-id').value;
            const data = {
                version_id: document.getElementById('edu-version-id').value,
                degree: document.getElementById('edu-degree').value,
                institution: document.getElementById('edu-institution').value,
                start_date: document.getElementById('edu-start-date').value,
                end_date: document.getElementById('edu-end-date').value,
                description: document.getElementById('edu-description').value,
            };

            try {
                if (id) {
                    await this.apiPut(`${API_BASE_URL}/education/${id}`, data);
                    alert('Education updated successfully!');
                } else {
                    await this.apiPost(`${API_BASE_URL}/education`, data);
                    alert('Education added successfully!');
                }
                this.hideForm('education');
                this.loadAllData();
            } catch (error) {
                console.error('Error saving education:', error);
                alert('Failed to save education.');
            }
        },

        // --- Projects ---
        async fetchAndRenderProjects(versionId) {
            try {
                const projects = await this.apiFetch(`${API_BASE_URL}/projects?versionId=${versionId}`);
                this.renderProjectsTable(projects);
            } catch (error) {
                console.error('Error fetching projects:', error);
            }
        },

        renderProjectsTable(projectsData) {
            const tableBody = document.querySelector('#projects-table tbody');
            tableBody.innerHTML = '';
            projectsData.forEach(item => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${item.version_id}</td>
                    <td>${item.title}</td>
                    <td>${item.link || ''}</td>
                    <td>${item.icon || ''}</td>
                    <td class="action-buttons">
                        <button data-id="${item.id}" data-section="projects" class="edit-button">Edit</button>
                        <button data-id="${item.id}" data-section="projects" class="delete-button">Delete</button>
                    </td>
                `;
                row.querySelector('.edit-button').addEventListener('click', this.populateProjectForm.bind(this, item));
                row.querySelector('.delete-button').addEventListener('click', this.handleDelete.bind(this, item.id, 'projects', item.version_id));
            });
        },

        populateProjectForm(item) {
            this.showForm('projects');
            document.getElementById('proj-id').value = item.id;
            document.getElementById('proj-version-id').value = item.version_id;
            document.getElementById('proj-title').value = item.title;
            document.getElementById('proj-description').value = item.description;
            document.getElementById('proj-link').value = item.link;
            document.getElementById('proj-icon').value = item.icon;
        },

        async handleProjectSubmit(event) {
            event.preventDefault();
            const id = document.getElementById('proj-id').value;
            const data = {
                version_id: document.getElementById('proj-version-id').value,
                title: document.getElementById('proj-title').value,
                description: document.getElementById('proj-description').value,
                link: document.getElementById('proj-link').value,
                icon: document.getElementById('proj-icon').value,
            };

            try {
                if (id) {
                    await this.apiPut(`${API_BASE_URL}/projects/${id}`, data);
                    alert('Project updated successfully!');
                } else {
                    await this.apiPost(`${API_BASE_URL}/projects`, data);
                    alert('Project added successfully!');
                }
                this.hideForm('projects');
                this.loadAllData();
            } catch (error) {
                console.error('Error saving project:', error);
                alert('Failed to save project.');
            }
        },

        // --- Skills ---
        async fetchAndRenderSkills(versionId) {
            try {
                const skills = await this.apiFetch(`${API_BASE_URL}/skills?versionId=${versionId}`);
                this.renderSkillsTable(skills);
            } catch (error) {
                console.error('Error fetching skills:', error);
            }
        },

        renderSkillsTable(skillsData) {
            const tableBody = document.querySelector('#skills-table tbody');
            tableBody.innerHTML = '';
            skillsData.forEach(item => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${item.version_id}</td>
                    <td>${item.category}</td>
                    <td>${item.name}</td>
                    <td>${item.level}%</td>
                    <td class="action-buttons">
                        <button data-id="${item.id}" data-section="skills" class="edit-button">Edit</button>
                        <button data-id="${item.id}" data-section="skills" class="delete-button">Delete</button>
                    </td>
                `;
                row.querySelector('.edit-button').addEventListener('click', this.populateSkillForm.bind(this, item));
                row.querySelector('.delete-button').addEventListener('click', this.handleDelete.bind(this, item.id, 'skills', item.version_id));
            });
        },

        populateSkillForm(item) {
            this.showForm('skills');
            document.getElementById('skill-id').value = item.id;
            document.getElementById('skill-version-id').value = item.version_id;
            document.getElementById('skill-category').value = item.category;
            document.getElementById('skill-name').value = item.name;
            document.getElementById('skill-level').value = item.level;
        },

        async handleSkillSubmit(event) {
            event.preventDefault();
            const id = document.getElementById('skill-id').value;
            const data = {
                version_id: document.getElementById('skill-version-id').value,
                category: document.getElementById('skill-category').value,
                name: document.getElementById('skill-name').value,
                level: parseInt(document.getElementById('skill-level').value),
            };

            try {
                if (id) {
                    await this.apiPut(`${API_BASE_URL}/skills/${id}`, data);
                    alert('Skill updated successfully!');
                } else {
                    await this.apiPost(`${API_BASE_URL}/skills`, data);
                    alert('Skill added successfully!');
                }
                this.hideForm('skills');
                this.loadAllData();
            } catch (error) {
                console.error('Error saving skill:', error);
                alert('Failed to save skill.');
            }
        },

        // --- Generic Delete ---
        async handleDelete(id, section, versionId) {
            if (!confirm(`Are you sure you want to delete this ${section} item?`)) {
                return;
            }
            try {
                // For single-entry items (summary, contact_info), versionId is not needed in DELETE URL
                let deleteUrl = `${API_BASE_URL}/${section}/${id}`;
                if (section !== 'summary' && section !== 'contact_info' && versionId) {
                    deleteUrl += `?versionId=${versionId}`;
                }
                await this.apiDelete(deleteUrl);
                alert(`${section} item deleted successfully!`);
                this.loadAllData();
            } catch (error) {
                console.error(`Error deleting ${section} item:`, error);
                alert(`Failed to delete ${section} item.`);
            }
        },

        // Helper function to format date to YYYY-MM-DD for input[type="date"]
        formatDateToInput(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
    };

    AdminApp.init();
});