document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api'; // Using a relative path is more robust

    const app = {
        init() {
            if (document.body.classList.contains('page-portfolio')) {
                this.handleNavLinks();
                this.updateActiveNavLinkOnScroll();
                this.initSkillBarsAnimation();
                this.updateFooterCopyrightYear();
                this.loadPortfolioContent();
                this.initScrollAnimations();
                this.initDarkMode();
                this.initLanguageSwitcher();
            }

            if (document.body.classList.contains('page-server-info')) {
                this.updatePageDates();
                this.initScrollAnimations();
                this.initDarkMode();
                this.setupSmartReturnLink();
            }
        },

        setupSmartReturnLink() {
            const backBtn = document.querySelector('.resume-nav a');
            if (!backBtn) return;

            const urlParams = new URLSearchParams(window.location.search);
            const fromSlug = urlParams.get('from') || sessionStorage.getItem('last_slug') || 'project-manager';
            
            backBtn.href = `/?v=${fromSlug}`;
            backBtn.innerHTML = `<i class="fas fa-arrow-left"></i> Back to Portfolio`;
        },

        initLanguageSwitcher() {
            const container = document.createElement('div');
            container.className = 'language-switcher';
            
            const urlParams = new URLSearchParams(window.location.search);
            const currentLang = urlParams.get('lang') || 'en';
            const currentSlug = urlParams.get('v') || 'default';

            container.innerHTML = `
                <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
                <button class="lang-btn ${currentLang === 'es' ? 'active' : ''}" data-lang="es">ES</button>
            `;
            document.body.appendChild(container);

            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('lang-btn')) {
                    const lang = e.target.dataset.lang;
                    window.location.search = `?v=${currentSlug}&lang=${lang}`;
                }
            });
        },

        initDarkMode() {
            const toggle = document.createElement('button');
            toggle.className = 'theme-toggle';
            toggle.innerHTML = '<i class="fas fa-moon"></i>';
            document.body.appendChild(toggle);

            const isDark = localStorage.getItem('dark-mode') === 'true';
            if (isDark) {
                document.body.classList.add('dark-mode');
                toggle.innerHTML = '<i class="fas fa-sun"></i>';
            }

            toggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const darkNow = document.body.classList.contains('dark-mode');
                localStorage.setItem('dark-mode', darkNow);
                toggle.innerHTML = darkNow ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            });
        },

        initScrollAnimations() {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, { threshold: 0.1 });

            // Wait for content to be rendered before observing
            setTimeout(() => {
                document.querySelectorAll('section, .experience-item, .project-card, .skill-category').forEach(el => {
                    el.classList.add('fade-in-up');
                    observer.observe(el);
                });
            }, 500);
        },

        async loadPortfolioContent() {
            const urlParams = new URLSearchParams(window.location.search);
            let slug = urlParams.get('v');
            const language = urlParams.get('lang') || 'en';

            // If no slug provided, redirect to the primary 'pm' version
            if (!slug) {
                window.location.search = `?v=pm&lang=${language}`;
                return;
            }

            try {
                const resumeData = await this.fetchComposedResume(slug, language);
                
                // Save current slug for the return link functionality
                sessionStorage.setItem('last_slug', slug);

                if (!resumeData || !resumeData.version) {
                    this.hideAllSections();
                    const header = document.querySelector('header');
                    if(header){
                        header.innerHTML = '<h1>Resume Not Found</h1><p>The requested resume version could not be loaded.</p>';
                    }
                    return;
                }
                
                // Render all sections with the data received
                this.updateNavTranslations(language);
                this.updateSectionTitles(resumeData.version);
                this.updateSectionVisibility(resumeData.version);
                this.renderContactInfo(resumeData.version); 
                this.renderSummary(resumeData.summary, resumeData.version);
                this.renderExperience(resumeData.experience || []);
                this.renderEducation(resumeData.education || []);
                this.renderProjects(resumeData.projects || []);
                this.renderSkills(resumeData.skills || []);

                // Re-initialize animations after content is rendered
                this.initSkillBarsAnimation();

            } catch (error) {
                console.error('Error loading portfolio content:', error);
                this.hideAllSections();
            }
        },

        async fetchComposedResume(slug, language) {
            const response = await fetch(`${API_BASE_URL}/resume/slug/${slug}/${language}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        },

        updateNavTranslations(lang) {
            const translations = {
                en: { home: 'Home' },
                es: { home: 'Inicio' }
            };
            const t = translations[lang] || translations.en;
            const homeLink = document.querySelector('.resume-nav a[href="#home"]');
            if (homeLink) homeLink.textContent = t.home;
        },

        updateSectionTitles(versionData) {
            this.setTitle('#about', versionData.title_summary, 'about');
            this.setTitle('#experience', versionData.title_experience, 'experience');
            this.setTitle('#skills', versionData.title_skills, 'skills');
            this.setTitle('#projects', versionData.title_projects, 'projects');
            this.setTitle('#education', versionData.title_education, 'education');
        },

        setTitle(sectionSelector, title, navId) {
            // Update Section Header
            const headerEl = document.querySelector(`${sectionSelector} h2`);
            if (headerEl && title) headerEl.textContent = title;

            // Update Nav Link
            const navLink = document.querySelector(`.resume-nav a[href="#${navId}"]`);
            if (navLink && title) navLink.textContent = title;
        },

        updateSectionVisibility(versionData) {
            this.setVisibility('#about', versionData.show_summary, 'about');
            this.setVisibility('#experience', versionData.show_experience, 'experience');
            this.setVisibility('#skills', versionData.show_skills, 'skills');
            this.setVisibility('#projects', versionData.show_projects, 'projects');
            this.setVisibility('#education', versionData.show_education, 'education');
        },

        setVisibility(selector, isVisible, navId = null) {
            const el = document.querySelector(selector);
            if (el) el.style.display = isVisible ? '' : 'none';

            if (navId) {
                const navLink = document.querySelector(`.resume-nav a[href="#${navId}"]`);
                if (navLink) navLink.style.display = isVisible ? '' : 'none';
            }
        },

        hideAllSections() {
            ['about', 'experience', 'skills', 'projects', 'education'].forEach(id => this.setVisibility(`#${id}`, false, id));
        },

        renderExperience(experienceData) {
            const container = document.querySelector('#experience .container');
            container.querySelectorAll('.experience-item').forEach(item => item.remove());

            experienceData.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('experience-item');
                const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Present';
                const startDate = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';

                const descriptionHtml = item.description.includes('\n') 
                    ? `<ul>${item.description.split('\n').filter(line => line.trim() !== '').map(line => `<li>${line}</li>`).join('')}</ul>`
                    : `<p>${item.description}</p>`;

                div.innerHTML = (
                    `
                    <div class="experience-header">
                        <div class="job-title">
                            <h3><i class="fas fa-briefcase"></i> ${item.role}</h3>
                        </div>
                        <div class="company-date">
                            <span class="company">${item.company}</span>
                            <span class="date"><i class="far fa-calendar-alt"></i> ${startDate} - ${endDate}</span>
                        </div>
                    </div>
                    <div class="experience-description">
                        ${descriptionHtml}
                    </div>
                `
                );
                container.appendChild(div);
            });
        },

        renderEducation(educationData) {
            const container = document.querySelector('#education .container');
            container.querySelectorAll('.education-item').forEach(item => item.remove());

            educationData.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('education-item');
                const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Ongoing';
                const startDate = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';

                div.innerHTML = (
                    `
                    <h3>${item.degree}</h3>
                    <div class="education-info">
                        <span class="school">${item.institution}</span>
                        <span class="date">${startDate} - ${endDate}</span>
                    </div>
                    ${item.description ? `<p>${item.description}</p>` : ''}
                `
                );
                container.appendChild(div);
            });
        },

        renderProjects(projectsData) {
            const container = document.querySelector('#projects .projects-container');
            container.querySelectorAll('.project-card').forEach(item => item.remove());

            const urlParams = new URLSearchParams(window.location.search);
            const currentSlug = urlParams.get('v') || 'project-manager';

            projectsData.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('project-card');
                
                // Check if link is external or internal
                const isExternal = item.link && (item.link.startsWith('http') || item.link.startsWith('//'));
                let finalLink = item.link;
                
                // If it's the internal server info page, append the return slug
                if (finalLink && finalLink.includes('server-info.html')) {
                    finalLink = `${finalLink}?from=${currentSlug}`;
                }

                const linkAttr = isExternal ? 'target="_blank" rel="noopener"' : '';
                const iconAttr = isExternal ? '<i class="fas fa-external-link-alt" style="margin-left: 8px; font-size: 0.8em;"></i>' : '<i class="fas fa-arrow-right" style="margin-left: 8px; font-size: 0.8em;"></i>';

                div.innerHTML = (
                    `
                    <div class="project-content">
                        <h3 class="project-title"><i class="fas fa-laptop-code"></i> ${item.name}</h3>
                        <p class="project-description">${item.description}</p>
                        ${finalLink ? `<a href="${finalLink}" class="btn" ${linkAttr}>Check it out ${iconAttr}</a>` : ''}
                    </div>
                `
                );
                container.appendChild(div);
            });
        },

        renderSkills(skillsData) {
            const container = document.querySelector('#skills .skills-container');
            container.innerHTML = ''; 

            if (!skillsData || skillsData.length === 0) return;

            // Group skills by category
            const groups = {};
            skillsData.forEach(skill => {
                const cat = skill.category || 'Technical Expertise';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(skill);
            });

            // Create a block for each category
            Object.entries(groups).forEach(([category, skills]) => {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('skill-category');
                
                const categoryTitle = document.createElement('h3');
                categoryTitle.textContent = category;
                categoryDiv.appendChild(categoryTitle);

                const skillsList = document.createElement('ul');
                skills.forEach(skill => {
                    const skillItem = document.createElement('li');
                    skillItem.innerHTML = (
                        `
                        <span class="skill-name">${skill.name}</span>
                        <span class="skill-level-bar">
                            <span class="skill-fill" data-level="${skill.percentage || 0}"></span>
                        </span>
                    `
                    );
                    skillsList.appendChild(skillItem);
                });
                categoryDiv.appendChild(skillsList);
                container.appendChild(categoryDiv);
            });
        },

        renderSummary(summaryData, versionData) {
            const summaryEl = document.querySelector('#about .summary');
            const subtitleEl = document.querySelector('header .subtitle');
            
            if (summaryEl) {
                if (summaryData && summaryData.content) {
                    // Replace newlines with <br> for better HTML rendering
                    summaryEl.innerHTML = summaryData.content.replace(/\n/g, '<br>');
                } else {
                    summaryEl.innerHTML = '';
                }
            }
            if (subtitleEl) {
                subtitleEl.textContent = versionData ? versionData.subtitle : '';
            }
        },

        renderContactInfo(versionData) {
            const headerContact = document.querySelector('header .contact-info');
            const footerSocial = document.querySelector('footer .social-links');
            const profilePic = document.querySelector('.profile-pic');
            const profileName = document.querySelector('header h1');

            if (headerContact) {
                headerContact.innerHTML = (
                    `
                    ${versionData.email ? `<a href="mailto:${versionData.email}"><i class="fas fa-envelope"></i> ${versionData.email}</a>` : ''}
                    ${versionData.phone ? `<a href="tel:${versionData.phone}"><i class="fas fa-phone"></i> ${versionData.phone}</a>` : ''}
                `
                );
            }

            if (footerSocial) {
                footerSocial.innerHTML = (
                    `
                    ${versionData.linkedin ? `<a href="${versionData.linkedin}" target="_blank" rel="noopener"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${versionData.github ? `<a href="${versionData.github}" target="_blank" rel="noopener"><i class="fab fa-github"></i></a>` : ''}
                    ${versionData.website ? `<a href="${versionData.website}" target="_blank" rel="noopener"><i class="fas fa-globe"></i></a>` : ''}
                `
                );
            }

            if (profilePic && versionData.profile_picture) {
                profilePic.src = versionData.profile_picture;
            }
            
            if (profileName && versionData.contact_name) {
                profileName.textContent = versionData.contact_name;
                if(profilePic) profilePic.alt = versionData.contact_name;
            }
        },

        async getLastGitHubUpdate() {
            try {
                const res = await fetch('https://api.github.com/repos/martomarzo/personalwebsite/commits');
                if (!res.ok) throw new Error('API error');
                const commits = await res.json();
                return commits.length ? new Date(commits[0].commit.author.date) : new Date();
            } catch (error) {
                console.error('GitHub API Error:', error);
                return new Date();
            }
        },

        async updatePageDates() {
            const date = await this.getLastGitHubUpdate();
            const dateString = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            document.querySelectorAll('#currentDate, #footerDate').forEach(el => el.textContent = dateString);
        },

        handleNavLinks() {
            document.querySelectorAll('.page-portfolio .resume-nav a').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetEl = document.querySelector(this.getAttribute('href'));
                    if (targetEl) {
                        const navHeight = document.querySelector('.resume-nav').offsetHeight;
                        window.scrollTo({ top: targetEl.offsetTop - navHeight, behavior: 'smooth' });
                    }
                });
            });
        },

        updateActiveNavLinkOnScroll() {
            const sections = document.querySelectorAll('.page-portfolio section[id]');
            const navLinks = document.querySelectorAll('.page-portfolio .resume-nav a');
            window.addEventListener('scroll', () => {
                let current = '';
                sections.forEach(section => {
                    const sectionTop = section.offsetTop - 150;
                    if (window.pageYOffset >= sectionTop) {
                        current = section.getAttribute('id');
                    }
                });
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href').substring(1) === current);
                });
            });
        },
        
        updateFooterCopyrightYear() {
            const el = document.querySelector('.page-portfolio .footer-text');
            if (el) el.textContent = `© ${new Date().getFullYear()} Martín Marzorati. All rights reserved.`;
        },

        initSkillBarsAnimation() {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const level = entry.target.getAttribute('data-level');
                        entry.target.style.width = `${level}%`;
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            document.querySelectorAll('.page-portfolio .skill-fill').forEach(fill => observer.observe(fill));
        }
    };

    app.init();
});
