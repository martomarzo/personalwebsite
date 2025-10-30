document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api'; // Your backend API base URL
    let currentVersionId = null; // To store the currently selected version ID

    /**
     * Main application object to organize the site's scripts.
     */
    const app = {
        /**
         * Initializes all necessary functions when the page loads.
         */
        init() {
            // Only run portfolio-specific scripts if we are on the portfolio page
            if (document.body.classList.contains('page-portfolio')) {
                this.handleNavLinks();
                this.updateActiveNavLinkOnScroll();
                this.initSkillBarsAnimation(); 
                this.updateFooterCopyrightYear();
                this.loadPortfolioContent(); // Load dynamic content directly
            }
            
            // Run server-info-specific scripts if we are on that page
            if (document.body.classList.contains('page-server-info')) {
                this.updatePageDates();
            }
        },

        /**
         * Loads dynamic content for the portfolio page.
         */
        async loadPortfolioContent() { // No longer accepts versionId as direct parameter
            let versionId = null;
            let currentVersionData = null; // To store the full version object
            const urlParams = new URLSearchParams(window.location.search);
            const urlVersionId = urlParams.get('versionId');

            if (urlVersionId) {
                versionId = urlVersionId;
                try {
                    currentVersionData = await this.apiFetch(`${API_BASE_URL}/resume_versions/${versionId}`);
                } catch (error) {
                    console.error('Error fetching specific version:', error);
                    versionId = null; // Fallback to default if specific version not found
                }
            }

            if (!versionId || !currentVersionData) {
                // Fetch the default version if no versionId in URL or specific version not found
                try {
                    const defaultVersion = await this.fetchDefaultVersion(); // Renamed helper
                    if (defaultVersion) {
                        versionId = defaultVersion.id;
                        currentVersionData = defaultVersion;
                    }
                } catch (error) {
                    console.error('Error fetching default version:', error);
                }
            }

            if (!versionId || !currentVersionData) {
                // Clear all content if no version is selected or default not found
                this.renderExperience([]);
                this.renderEducation([]);
                this.renderProjects([]);
                this.renderSkills([]);
                this.renderSummary({ content: '', subtitle: '' });
                this.renderContactInfo({});
                this.hideAllSections(); // Hide all sections if no data
                return;
            }

            // Update section titles and visibility
            this.updateSectionTitles(currentVersionData);
            this.updateSectionVisibility(currentVersionData);

            try {
                const experienceData = await this.fetchExperience(versionId);
                this.renderExperience(experienceData);

                const educationData = await this.fetchEducation(versionId);
                this.renderEducation(educationData);

                const projectsData = await this.fetchProjects(versionId);
                this.renderProjects(projectsData);

                const skillsData = await this.fetchSkills(versionId);
                this.renderSkills(skillsData);

                const summaryData = await this.fetchSummary(versionId);
                this.renderSummary(summaryData);

                const contactInfoData = await this.fetchContactInfo(); // Contact info is global
                this.renderContactInfo(contactInfoData);

            } catch (error) {
                console.error('Error loading portfolio content:', error);
                // Optionally render a fallback message or handle the error gracefully
            }
        },

        async fetchDefaultVersion() {
            const response = await fetch(`${API_BASE_URL}/resume_versions?is_default=true`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const versions = await response.json();
            return versions.length > 0 ? versions[0] : null;
        },

        updateSectionTitles(versionData) {
            document.querySelector('#about h2').textContent = versionData.title_professional_summary || 'Professional Summary';
            document.querySelector('#experience h2').textContent = versionData.title_professional_experience || 'Professional Experience';
            document.querySelector('#skills h2').textContent = versionData.title_technical_skills || 'Technical Skills & Expertise';
            document.querySelector('#projects h2').textContent = versionData.title_personal_projects || 'Personal Projects';
            document.querySelector('#education h2').textContent = versionData.title_education || 'Education';
            document.querySelector('#languages h2').textContent = versionData.title_languages || 'Languages';
        },

        updateSectionVisibility(versionData) {
            document.getElementById('about').style.display = versionData.show_professional_summary ? 'block' : 'none';
            document.getElementById('experience').style.display = versionData.show_professional_experience ? 'block' : 'none';
            document.getElementById('skills').style.display = versionData.show_technical_skills ? 'block' : 'none';
            document.getElementById('projects').style.display = versionData.show_personal_projects ? 'block' : 'none';
            document.getElementById('education').style.display = versionData.show_education ? 'block' : 'none';
            document.getElementById('languages').style.display = versionData.show_languages ? 'block' : 'none';
        },

        hideAllSections() {
            document.getElementById('about').style.display = 'none';
            document.getElementById('experience').style.display = 'none';
            document.getElementById('skills').style.display = 'none';
            document.getElementById('projects').style.display = 'none';
            document.getElementById('education').style.display = 'none';
            document.getElementById('languages').style.display = 'none';
        },

        async fetchResumeVersions() {
            const response = await fetch(`${API_BASE_URL}/resume_versions`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Fetches experience data from the backend API.
         */
        async fetchExperience(versionId) {
            const response = await fetch(`${API_BASE_URL}/experience?versionId=${versionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Renders experience data into the DOM.
         */
        renderExperience(experienceData) {
            const experienceContainer = document.querySelector('#experience .container');
            // Clear existing dynamic content, but keep the H2 title
            const existingItems = experienceContainer.querySelectorAll('.experience-item');
            existingItems.forEach(item => item.remove());

            experienceData.forEach(item => {
                const experienceItemDiv = document.createElement('div');
                experienceItemDiv.classList.add('experience-item');

                const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Present';
                const startDate = new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

                experienceItemDiv.innerHTML = `
                    <div class="job-title">
                        <h3>${item.title}</h3>
                    </div>
                    <div class="company-date">
                        <span class="company">${item.company}</span>
                        <span class="date">${startDate} - ${endDate}</span>
                    </div>
                    <p class="location">${item.location}</p>
                    <ul>
                        ${item.description.split('\n').map(line => `<li>${line}</li>`).join('')}
                    </ul>
                    ${item.contact_person ? `<p class="contact-person">Contact: ${item.contact_person} ${item.contact_email ? `(${item.contact_email})` : ''}</p>` : ''}
                `;
                experienceContainer.appendChild(experienceItemDiv);
            });
        },

        /**
         * Fetches education data from the backend API.
         */
        async fetchEducation(versionId) {
            const response = await fetch(`${API_BASE_URL}/education?versionId=${versionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Renders education data into the DOM.
         */
        renderEducation(educationData) {
            const educationContainer = document.querySelector('#education .container');
            const existingItems = educationContainer.querySelectorAll('.education-item');
            existingItems.forEach(item => item.remove());

            educationData.forEach(item => {
                const educationItemDiv = document.createElement('div');
                educationItemDiv.classList.add('education-item');

                const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Ongoing';
                const startDate = new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

                educationItemDiv.innerHTML = `
                    <h3>${item.degree}</h3>
                    <div class="education-info">
                        <span class="school">${item.institution}</span>
                        <span class="date">${startDate} - ${endDate}</span>
                    </div>
                    ${item.description ? `<p>${item.description}</p>` : ''}
                `;
                educationContainer.appendChild(educationItemDiv);
            });
        },

        /**
         * Fetches project data from the backend API.
         */
        async fetchProjects(versionId) {
            const response = await fetch(`${API_BASE_URL}/projects?versionId=${versionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Renders project data into the DOM.
         */
        renderProjects(projectsData) {
            const projectsContainer = document.querySelector('#projects .projects-container');
            // Clear existing dynamic content
            const existingItems = projectsContainer.querySelectorAll('.project-card');
            existingItems.forEach(item => item.remove());

            projectsData.forEach(item => {
                const projectCardDiv = document.createElement('div');
                projectCardDiv.classList.add('project-card');

                projectCardDiv.innerHTML = `
                    <div class="project-content">
                        <h3 class="project-title">${item.icon ? `<i class="${item.icon}"></i>` : ''}${item.title}</h3>
                        <p class="project-description">${item.description}</p>
                        ${item.link ? `<a href="${item.link}" class="btn" target="_blank" rel="noopener">Check it out</a>` : ''}
                    </div>
                `;
                projectsContainer.appendChild(projectCardDiv);
            });
        },

        /**
         * Fetches skills data from the backend API.
         */
        async fetchSkills(versionId) {
            const response = await fetch(`${API_BASE_URL}/skills?versionId=${versionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Renders skills data into the DOM.
         */
        renderSkills(skillsData) {
            const skillsContainer = document.querySelector('#skills .skills-container');
            const existingCategories = skillsContainer.querySelectorAll('.skill-category');
            existingCategories.forEach(item => item.remove());

            // Group skills by category
            const skillsByCategory = skillsData.reduce((acc, skill) => {
                (acc[skill.category] = acc[skill.category] || []).push(skill);
                return acc;
            }, {});

            for (const category in skillsByCategory) {
                const skillCategoryDiv = document.createElement('div');
                skillCategoryDiv.classList.add('skill-category');
                let skillsHtml = `<h3>${category}</h3><ul>`;
                skillsByCategory[category].forEach(skill => {
                    skillsHtml += `
                        <li>
                            <span class="skill-name">${skill.name}</span>
                            <span class="skill-level-bar"><span class="skill-fill" data-level="${skill.level}"></span></span>
                        </li>
                    `;
                });
                skillsHtml += `</ul>`;
                skillCategoryDiv.innerHTML = skillsHtml;
                skillsContainer.appendChild(skillCategoryDiv);
            }
            // Re-initialize skill bar animations after rendering new skills
            this.initSkillBarsAnimation();
        },

        /**
         * Fetches professional summary data from the backend API.
         */
        async fetchSummary(versionId) {
            const response = await fetch(`${API_BASE_URL}/summary?versionId=${versionId}`);
            if (!response.ok) {
                // If summary is not found (404), return an empty object or handle as needed
                if (response.status === 404) return { content: '', subtitle: '' };
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Renders professional summary data into the DOM.
         */
        renderSummary(summaryData) {
            const summaryElement = document.querySelector('#about .summary');
            const subtitleP = document.querySelector('header .subtitle');

            if (summaryElement && summaryData.content) {
                summaryElement.textContent = summaryData.content;
            }
            if (subtitleP && summaryData.subtitle) {
                subtitleP.textContent = summaryData.subtitle;
            }
        },

        /**
         * Fetches contact information from the backend API.
         */
        async fetchContactInfo() { // No longer accepts versionId
            const response = await fetch(`${API_BASE_URL}/contact_info`);
            if (!response.ok) {
                // If contact info is not found (404), return an empty object or handle as needed
                if (response.status === 404) return {};
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        /**
         * Renders contact information into the DOM.
         */
        renderContactInfo(contactInfoData) {
            const headerContactInfo = document.querySelector('header .contact-info');
            const footerSocialLinks = document.querySelector('footer .social-links');
            const profilePicDiv = document.querySelector('.profile-pic');
            // Subtitle is now handled by renderSummary

            if (headerContactInfo) {
                headerContactInfo.innerHTML = `
                    ${contactInfoData.email ? `<a href="mailto:${contactInfoData.email}"><i class="fas fa-envelope"></i> ${contactInfoData.email}</a>` : ''}
                    ${contactInfoData.phone ? `<a href="tel:${contactInfoData.phone}"><i class="fas fa-phone"></i> ${contactInfoData.phone}</a>` : ''}
                `;
            }

            if (footerSocialLinks) {
                footerSocialLinks.innerHTML = `
                    ${contactInfoData.linkedin_url ? `<a href="${contactInfoData.linkedin_url}" target="_blank" rel="noopener"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${contactInfoData.github_url ? `<a href="${contactInfoData.github_url}" target="_blank" rel="noopener"><i class="fab fa-github"></i></a>` : ''}
                    ${contactInfoData.instagram_url ? `<a href="${contactInfoData.instagram_url}" target="_blank" rel="noopener"><i class="fab fa-instagram"></i></a>` : ''}
                `;
            }

            if (profilePicDiv && contactInfoData.profile_pic_url) {
                console.log('Profile pic div found:', profilePicDiv);
                console.log('Profile pic URL from data:', contactInfoData.profile_pic_url);
                profilePicDiv.style.backgroundImage = `url('${contactInfoData.profile_pic_url}')`;
                console.log('Applied background-image style:', profilePicDiv.style.backgroundImage);
            }
        },

        /**
         * Fetches the last commit date from the GitHub API.
         */
        async getLastGitHubUpdate() {
            const username = 'martomarzo';
            const repository = 'personalwebsite';
            const apiUrl = `https://api.github.com/repos/${username}/${repository}/commits`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
                const commits = await response.json();
                if (!commits.length) throw new Error('No commits found');
                
                const lastCommit = commits[0];
                return new Date(lastCommit.commit.author.date);
            } catch (error) {
                console.error('GitHub API Error:', error);
                return new Date(); // Fallback to current date on error
            }
        },

        /**
         * Updates the date elements on the server-info page.
         */
        async updatePageDates() {
            const date = await this.getLastGitHubUpdate();
            const dateString = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            document.querySelectorAll('#currentDate, #footerDate').forEach(el => {
                el.textContent = dateString;
            });
        },

        /**
         * Handles smooth scrolling for navigation links.
         */
        handleNavLinks() {
            document.querySelectorAll('.page-portfolio .resume-nav a').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetId = this.getAttribute('href');
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        const navHeight = document.querySelector('.resume-nav').offsetHeight;
                        window.scrollTo({
                            top: targetElement.offsetTop - navHeight,
                            behavior: 'smooth'
                        });
                    }
                });
            });
        },

        /**
         * Updates the active navigation link based on scroll position.
         */
        updateActiveNavLinkOnScroll() {
            const sections = document.querySelectorAll('.page-portfolio section[id]');
            const navLinks = document.querySelectorAll('.page-portfolio .resume-nav a');

            window.addEventListener('scroll', () => {
                let current = '';
                const scrollY = window.pageYOffset;

                sections.forEach(section => {
                    const sectionTop = section.offsetTop - 150; // Offset for better accuracy
                    if (scrollY >= sectionTop) {
                        current = section.getAttribute('id');
                    }
                });

                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === current) {
                        link.classList.add('active');
                    }
                });
            });
        },
        
        /**
         * Updates the copyright year in the footer.
         */
        updateFooterCopyrightYear() {
            const footerText = document.querySelector('.page-portfolio .footer-text');
            if (footerText) {
                const currentYear = new Date().getFullYear();
                footerText.textContent = `© ${currentYear} Martín Marzorati. All rights reserved.`;
            }
        },

        /**
         * Initializes the animation for the skill bars using IntersectionObserver.
         
         */
        initSkillBarsAnimation() {
            const skillFills = document.querySelectorAll('.page-portfolio .skill-fill');

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const level = entry.target.getAttribute('data-level');
                        entry.target.style.width = `${level}%`;
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1
            });

            skillFills.forEach(fill => {
                observer.observe(fill);
            });
        }
    };

    app.init();
});