document.addEventListener('DOMContentLoaded', () => {
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
            }
            
            // Run server-info-specific scripts if we are on that page
            if (document.body.classList.contains('page-server-info')) {
                this.updatePageDates();
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