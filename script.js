// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Handle navigation link clicks
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            window.scrollTo({
                top: targetElement.offsetTop - document.querySelector('.resume-nav').offsetHeight,
                behavior: 'smooth'
            });
            
            // Update active link
            document.querySelectorAll('nav a').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Update active nav link on scroll
    window.addEventListener('scroll', function() {
        const scrollPosition = window.scrollY + document.querySelector('.resume-nav').offsetHeight + 50;
        
        document.querySelectorAll('section').forEach(section => {
            if (section.offsetTop <= scrollPosition && section.offsetTop + section.offsetHeight > scrollPosition) {
                const currentId = section.getAttribute('id');
                document.querySelectorAll('nav a').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + currentId) {
                        link.classList.add('active');
                    }
                });
            }
        });
        
        // Handle home section separately
        if (scrollPosition < document.querySelector('#about').offsetTop) {
            document.querySelectorAll('nav a').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#home') {
                    link.classList.add('active');
                }
            });
        }
    });
    
    // Add year to copyright text
    const currentYear = new Date().getFullYear();
    const footerText = document.querySelector('.footer-text');
    if (footerText) {
        footerText.textContent = `© ${currentYear} Martín Marzorati. All rights reserved.`;
    }
    
    // Initialize download CV link if PDF is available
    const downloadButton = document.querySelector('.download-cv');
    if (downloadButton) {
        downloadButton.addEventListener('click', function(e) {
            // This would be connected to your PDF resume when available
            const pdfAvailable = true; // Set to true when you have a PDF to link
            
            if (!pdfAvailable) {
                e.preventDefault();
                alert('PDF resume coming soon!');
            }
        });
    }
});

// Add animation to skills on viewport entry
document.addEventListener('DOMContentLoaded', function() {
    // Optional: Only run if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
        const skillCategories = document.querySelectorAll('.skill-category');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = 1;
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });
        
        // Set initial state and observe
        skillCategories.forEach(category => {
            category.style.opacity = 0;
            category.style.transform = 'translateY(20px)';
            category.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(category);
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const skillBars = document.querySelectorAll('.skill-level-bar');
    skillBars.forEach(bar => {
        const level = bar.querySelector('.skill-fill').getAttribute('data-level');
        const fillElement = bar.querySelector('.skill-fill');

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    fillElement.style.width = `${level}%`;
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(bar);
        fillElement.style.width = '0%'; // Initialize width to 0 for animation
    });
});