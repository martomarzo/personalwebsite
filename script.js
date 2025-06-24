





// GitHub API function
async function getLastGitHubUpdate() {
    try {
     
        const username = 'martomarzo'; 
        const repository = 'personalwebsite'; 
        
        
        
        const apiUrl = `https://api.github.com/repos/${username}/${repository}/commits`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            console.error('GitHub API error:', response.status);
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const commits = await response.json();
        
        if (commits.length === 0) {
            throw new Error('No commits found');
        }
        
        const lastCommit = commits[0];
        const updateInfo = {
            date: new Date(lastCommit.commit.author.date),
            message: lastCommit.commit.message,
            author: lastCommit.commit.author.name,
            sha: lastCommit.sha.substring(0, 7)
        };
        
        
        return updateInfo;
        
    } catch (error) {
        
        // Fallback to current date
        return {
            date: new Date(),
            message: 'Current time (GitHub unavailable)',
            author: 'System',
            sha: 'N/A'
        };
    }
}

// Update page dates function
async function updatePageDates() {
    
    
    const currentDateEl = document.getElementById('currentDate');
    const footerDateEl = document.getElementById('footerDate');
    
    // Show loading state
    if (currentDateEl) currentDateEl.textContent = 'Loading...';
    if (footerDateEl) footerDateEl.textContent = 'Loading...';
    
    try {
        const updateInfo = await getLastGitHubUpdate();
        
        const dateString = updateInfo.date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const displayText = `${dateString}`;
        
        if (currentDateEl) {
            currentDateEl.textContent = displayText;
            currentDateEl.title = `${updateInfo.message} (${updateInfo.sha})`;
        }
        
        if (footerDateEl) {
            footerDateEl.textContent = displayText;
            footerDateEl.title = `${updateInfo.message} (${updateInfo.sha})`;
        }
        
        
        
    } catch (error) {
        console.error('❌ Failed to update dates:', error);
    }
}

// DOM Ready Event Listener
document.addEventListener('DOMContentLoaded', function() {
    
    
    // 1. Update dates from GitHub
    updatePageDates();
    
    // 2. Handle navigation link clicks
    const navLinks = document.querySelectorAll('nav a');
    if (navLinks.length > 0) {
        navLinks.forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    const navHeight = document.querySelector('.resume-nav')?.offsetHeight || 0;
                    window.scrollTo({
                        top: targetElement.offsetTop - navHeight,
                        behavior: 'smooth'
                    });
                    
                    // Update active link
                    navLinks.forEach(link => link.classList.remove('active'));
                    this.classList.add('active');
                }
            });
        });
        
    }
    
    // 3. Update active nav link on scroll
    window.addEventListener('scroll', function() {
        const navElement = document.querySelector('.resume-nav');
        if (!navElement) return;
        
        const scrollPosition = window.scrollY + navElement.offsetHeight + 50;
        
        document.querySelectorAll('section').forEach(section => {
            if (section.offsetTop <= scrollPosition && section.offsetTop + section.offsetHeight > scrollPosition) {
                const currentId = section.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + currentId) {
                        link.classList.add('active');
                    }
                });
            }
        });
        
        // Handle home section separately
        const aboutSection = document.querySelector('#about');
        if (aboutSection && scrollPosition < aboutSection.offsetTop) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#home') {
                    link.classList.add('active');
                }
            });
        }
    });
    
    // 4. Update footer copyright year
    const footerText = document.querySelector('.footer-text');
    if (footerText) {
        const currentYear = new Date().getFullYear();
        footerText.textContent = `© ${currentYear} Martín Marzorati. All rights reserved.`;
        
    }
    
    // 5. Initialize skill bars animation
    const skillBars = document.querySelectorAll('.skill-level-bar');
    if (skillBars.length > 0) {
        skillBars.forEach(bar => {
            const fillElement = bar.querySelector('.skill-fill');
            const level = fillElement?.getAttribute('data-level');
            
            if (fillElement && level) {
                const observer = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            fillElement.style.width = `${level}%`;
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.5 });
                
                observer.observe(bar);
                fillElement.style.width = '0%'; // Initialize width
            }
        });
        
    }
    
    // 6. Initialize skill categories animation
    if ('IntersectionObserver' in window) {
        const skillCategories = document.querySelectorAll('.skill-category');
        
        if (skillCategories.length > 0) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = 1;
                        entry.target.style.transform = 'translateY(0)';
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            
            // Set initial state and observe
            skillCategories.forEach(category => {
                category.style.opacity = 0;
                category.style.transform = 'translateY(20px)';
                category.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                observer.observe(category);
            });
            
        }
    }
    
    // 7. Initialize experience items hover animation
    const experienceItems = document.querySelectorAll('.experience-item');
    if (experienceItems.length > 0) {
        experienceItems.forEach(item => {
            item.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1)';
            
            item.addEventListener('mouseenter', function() {
                item.style.transform = 'translateY(-6px) scale(1.02)';
                item.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
            });
            
            item.addEventListener('mouseleave', function() {
                item.style.transform = '';
                item.style.boxShadow = '';
            });
        });
       
    }
    
    // 8. Initialize download CV button
    const downloadButton = document.querySelector('.download-cv');
    if (downloadButton) {
        downloadButton.addEventListener('click', function(e) {
            // Check if PDF is available
            const pdfAvailable = true; // Set to true when you have a PDF
            
            if (!pdfAvailable) {
                e.preventDefault();
                alert('PDF resume coming soon!');
            }
        });
        
    }
    
    
});

// Handle immediate execution if DOM is already ready
if (document.readyState === 'loading') {
    
} else {
    
    // The event listener above will handle everything
}

// Export functions for debugging
window.updatePageDates = updatePageDates;
window.getLastGitHubUpdate = getLastGitHubUpdate;

