document.addEventListener('DOMContentLoaded', () => {
    const app = {
        init() {
            this.updatePageDates();
            this.handleNavLinks();
            this.updateActiveNavLinkOnScroll();
            this.updateFooterCopyrightYear();
            this.initSkillBarsAnimation();
        },

        async getLastGitHubUpdate() {
            const username = 'martomarzo';
            const repository = 'personalwebsite';
            const apiUrl = `https://api.github.com/repos/${username}/${repository}/commits`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }
                const commits = await response.json();
                if (commits.length === 0) {
                    throw new Error('No commits found');
                }
                const lastCommit = commits[0];
                return {
                    date: new Date(lastCommit.commit.author.date),
                    message: lastCommit.commit.message,
                };
            } catch (error) {
                console.error('GitHub API Error:', error);
                return {
                    date: new Date(),
                    message: 'Could not fetch last update time.',
                };
            }
        },

        async updatePageDates() {
            const updateInfo = await this.getLastGitHubUpdate();
            const dateString = updateInfo.date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const dateElements = document.querySelectorAll('.last-updated');
            dateElements.forEach(el => {
                el.textContent = dateString;
                el.title = updateInfo.message;
            });
        },

        handleNavLinks() {
            const navLinks = document.querySelectorAll('nav a');
            navLinks.forEach(anchor => {
                anchor.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = e.currentTarget.getAttribute('href');
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        const navHeight = document.querySelector('.resume-nav').offsetHeight;
                        window.scrollTo({
                            top: targetElement.offsetTop - navHeight,
                            behavior: 'smooth',
                        });
                        navLinks.forEach(link => link.classList.remove('active'));
                        e.currentTarget.classList.add('active');
                    }
                });
            });
        },

        updateActiveNavLinkOnScroll() {
            window.addEventListener('scroll', () => {
                const navElement = document.querySelector('.resume-nav');
                if (!navElement) return;

                const scrollPosition = window.scrollY + navElement.offsetHeight + 50;
                const sections = document.querySelectorAll('section');
                const navLinks = document.querySelectorAll('nav a');

                sections.forEach(section => {
                    if (scrollPosition >= section.offsetTop && scrollPosition < section.offsetTop + section.offsetHeight) {
                        const currentId = section.getAttribute('id');
                        navLinks.forEach(link => {
                            link.classList.remove('active');
                            if (link.getAttribute('href') === `#${currentId}`) {
                                link.classList.add('active');
                            }
                        });
                    }
                });
            });
        },

        updateFooterCopyrightYear() {
            const footerText = document.querySelector('.footer-text');
            if (footerText) {
                const currentYear = new Date().getFullYear();
                footerText.textContent = `© ${currentYear} Martín Marzorati. All rights reserved.`;
            }
        },

        initSkillBarsAnimation() {
            const skillBars = document.querySelectorAll('.skill-level-bar');

            // Set up the observer to watch for when skill bars enter the viewport
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    // When a bar is 50% visible...
                    if (entry.isIntersecting) {
                        const fillElement = entry.target.querySelector('.skill-fill');
                        const level = fillElement.getAttribute('data-level');
                        
                        // ...set the width to trigger the CSS transition
                        fillElement.style.width = `${level}%`;
                        
                        // Stop watching this bar to prevent re-triggering
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                // Trigger when 50% of the item is visible
                threshold: 0.5
            });

            // Tell the observer to watch each skill bar
            skillBars.forEach(bar => {
                observer.observe(bar);
            });
        }
    };

    app.init();
});