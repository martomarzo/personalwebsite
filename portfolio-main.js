document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api'; // Using a relative path is more robust

    const app = {
        init() {
            if (document.body.classList.contains('page-portfolio')) {
                this.handleNavLinks();
                this.updateActiveNavLinkOnScroll();
                this.updateFooterCopyrightYear();
                this.loadPortfolioContent();
                this.initDarkMode();
                this.initLanguageSwitcher();
            }

            if (document.body.classList.contains('page-server-info')) {
                this.loadServerInfo();
                this.updatePageDates();
                this.initDarkMode();
                this.setupSmartReturnLink();
            }
        },

        async loadServerInfo() {
            const main = document.querySelector('main');
            if (!main) return;

            try {
                const response = await fetch('/api/server-info');
                const sections = await response.json();

                if (!sections || sections.length === 0) {
                    main.innerHTML = '<p>No server information available.</p>';
                    return;
                }

                main.innerHTML = ''; // Clear hardcoded content

                sections.forEach(section => {
                    const sectionEl = document.createElement('section');
                    sectionEl.id = section.title.toLowerCase().replace(/ /g, '-');
                    sectionEl.className = '';
                    
                    let html = `<h2><i class="${section.icon || 'fas fa-info-circle'}"></i> ${section.title}</h2>`;
                    
                    if (section.layout_type === 'text') {
                        html += `
                            <div class="experience-item">
                                <p>${section.description || ''}</p>
                            </div>
                        `;
                    } else if (section.layout_type === 'node') {
                        const specs = section.items.filter(i => i.item_type === 'spec');
                        const services = section.items.filter(i => i.item_type === 'service');

                        html += `
                            <div class="node-container">
                                ${section.description ? `<p class="node-intro">${section.description}</p>` : ''}
                                
                                <div class="node-grid">
                                    <div class="node-specs">
                                        <h3><i class="fas fa-microchip"></i> Hardware Specs</h3>
                                        <div class="specs-grid">
                                            ${specs.map(spec => `
                                                <div class="spec-card">
                                                    <i class="${spec.icon || 'fas fa-info-circle'}"></i>
                                                    <div class="spec-info">
                                                        <span class="spec-label">${spec.title}</span>
                                                        <span class="spec-value">${spec.content}</span>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <div class="node-services">
                                        <h3><i class="fas fa-project-diagram"></i> Running Services</h3>
                                        <div class="services-table-wrapper">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Service</th>
                                                        <th>Type</th>
                                                        <th>Role/Function</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${services.map(svc => `
                                                        <tr>
                                                            <td><strong>${svc.title}</strong></td>
                                                            <td><span class="platform-tag">${svc.platform || 'VM'}</span></td>
                                                            <td>${svc.function || svc.content}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else if (section.layout_type === 'grid') {
                        html += `
                            <div class="skills-container">
                                ${section.items.map(item => `
                                    <div class="skill-category">
                                        <h3>${item.title}</h3>
                                        <p>${item.content || ''}</p>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    } else if (section.layout_type === 'table') {
                        html += `
                            <div class="experience-item" style="overflow-x: auto;">
                                ${section.description ? `<p style="margin-bottom: 20px;">${section.description}</p>` : ''}
                                <table style="width: 100%;">
                                    <thead>
                                        <tr>
                                            <th>Service</th>
                                            <th>Platform</th>
                                            <th>Primary Function</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${section.items.map(item => `
                                            <tr>
                                                <td>${item.title}</td>
                                                <td>${item.platform || ''}</td>
                                                <td>${item.function || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else { // 'list'
                        html += `
                            <div class="experience-item">
                                ${section.description ? `<p style="margin-bottom: 15px;">${section.description}</p>` : ''}
                                <div class="experience-description">
                                    <ul>
                                        ${section.items.map(item => `
                                            <li><strong>${item.title}:</strong> ${item.content || ''}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            </div>
                        `;
                    }

                    sectionEl.innerHTML = html;
                    main.appendChild(sectionEl);
                });

                // (scroll animations handled globally)

            } catch (err) {
                console.error('Error loading server info:', err);
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
            document.body.appendChild(toggle);

            const updateIcon = () => {
                const isLight = document.documentElement.classList.contains('light-mode');
                toggle.innerHTML = isLight
                    ? '<i class="fas fa-moon"></i>'
                    : '<i class="fas fa-sun"></i>';
            };

            updateIcon();

            toggle.addEventListener('click', () => {
                document.documentElement.classList.toggle('light-mode');
                const isLight = document.documentElement.classList.contains('light-mode');
                localStorage.setItem('theme-mode', isLight ? 'light' : 'dark');
                updateIcon();
            });
        },

        initHeroAnimations() {
            if (typeof gsap === 'undefined') return;
            gsap.registerPlugin(ScrollTrigger);

            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
            tl.from('.page-portfolio .profile-pic', { opacity: 0, scale: 0.88, duration: 0.7 })
              .from('.page-portfolio h1',           { opacity: 0, y: 20, duration: 0.5 }, '-=0.3')
              .from('.page-portfolio .subtitle',    { opacity: 0, y: 14, duration: 0.45 }, '-=0.25')
              .from('.page-portfolio .contact-info a', { opacity: 0, y: 10, stagger: 0.08, duration: 0.4 }, '-=0.2');
        },

        initScrollTriggerAnimations() {
            if (typeof gsap === 'undefined') return;

            // Section headings slide in from left
            document.querySelectorAll('.page-portfolio h2').forEach(el => {
                gsap.from(el, {
                    opacity: 0, x: -24, duration: 0.6, ease: 'power2.out',
                    scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none none' }
                });
            });

            // Cards stagger in
            const cardSelectors = [
                '.page-portfolio .experience-item',
                '.page-portfolio .education-item'
            ];
            cardSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach((el, i) => {
                    gsap.from(el, {
                        opacity: 0, y: 30, duration: 0.55, ease: 'power2.out',
                        delay: (i % 2) * 0.08,
                        scrollTrigger: { trigger: el, start: 'top 89%', toggleActions: 'play none none none' }
                    });
                });
            });

            // Project cards batch
            if (ScrollTrigger.batch) {
                ScrollTrigger.batch('.page-portfolio .project-card', {
                    onEnter: batch => gsap.from(batch, { opacity: 0, y: 30, duration: 0.55, ease: 'power2.out', stagger: 0.1 }),
                    start: 'top 89%'
                });

                ScrollTrigger.batch('.page-portfolio .skill-category', {
                    onEnter: batch => gsap.from(batch, { opacity: 0, y: 24, duration: 0.5, ease: 'power2.out', stagger: 0.08 }),
                    start: 'top 89%'
                });
            }
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
                this.initHeroAnimations();
                this.renderSummary(resumeData.summary, resumeData.version);
                this.renderExperience(resumeData.experience || []);
                this.renderEducation(resumeData.education || []);
                this.renderProjects(resumeData.projects || []);
                this.renderSkills(resumeData.skills || []);
                this.initScrollTriggerAnimations();
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
                headerContact.innerHTML = `
                    ${versionData.email ? `<a href="mailto:${versionData.email}" title="${versionData.email}"><i class="fas fa-envelope"></i></a>` : ''}
                    ${versionData.phone ? `<a href="tel:${versionData.phone}" title="${versionData.phone}"><i class="fas fa-phone"></i></a>` : ''}
                    ${versionData.linkedin ? `<a href="${versionData.linkedin}" target="_blank" rel="noopener" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${versionData.github ? `<a href="${versionData.github}" target="_blank" rel="noopener" title="GitHub"><i class="fab fa-github"></i></a>` : ''}
                    ${versionData.website ? `<a href="${versionData.website}" target="_blank" rel="noopener" title="Website"><i class="fas fa-globe"></i></a>` : ''}
                `;
            }

            if (footerSocial) {
                footerSocial.innerHTML = ''; // Moved to header
            }

            if (profilePic) {
                profilePic.src = versionData.profile_picture || 'photos/Martin.jpg';
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
            if (el) el.textContent = `Made with ❤️ by Me. Last Update: ${new Date().getFullYear()}`;
        },

        initSkillBarsAnimation() {
            if (typeof gsap !== 'undefined') {
                document.querySelectorAll('.page-portfolio .skill-fill').forEach(fill => {
                    const level = fill.getAttribute('data-level') || 0;
                    gsap.to(fill, {
                        width: `${level}%`,
                        duration: 1.1,
                        ease: 'power2.out',
                        scrollTrigger: {
                            trigger: fill,
                            start: 'top 90%',
                            toggleActions: 'play none none none'
                        }
                    });
                });
            } else {
                document.querySelectorAll('.page-portfolio .skill-fill').forEach(fill => {
                    fill.style.width = `${fill.getAttribute('data-level') || 0}%`;
                });
            }
        }
    };

    app.init();
});
