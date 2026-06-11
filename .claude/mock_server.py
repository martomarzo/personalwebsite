# Temporary mock server for design preview only — serves the static frontend
# plus a stubbed /api/resume response with real content from data_dump.sql.
# Not part of the app. Safe to delete.
import json
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PORT = 4173

RESUME = {
    "version": {
        "name": "PM", "slug": "pm",
        "contact_name": "Martin Marzorati",
        "subtitle": "Project Manager / Producer",
        "email": "hi@martomarzo.com", "phone": "+34614014399",
        "linkedin": "https://www.linkedin.com/in/martinmarzorati/",
        "github": "https://github.com/martomarzo",
        "website": "https://www.about.martomarzo.com",
        "profile_picture": "photos/Martin.jpg",
        "title_summary": "Professional Summary", "show_summary": True,
        "title_experience": "Professional Experience", "show_experience": True,
        "title_skills": "Technical Skills & Expertise", "show_skills": True,
        "title_projects": "Personal Projects", "show_projects": True,
        "title_education": "Education", "show_education": True,
    },
    "summary": {
        "content": "Detail-oriented Project Manager with 7+ years of experience leading cross-functional teams in digital media and tech environments. Combines strong technical background in software development with exceptional leadership skills. Proficient in multiple programming languages and experienced in maintaining server infrastructure. Skilled at optimizing workflows and delivering complex projects on time and within budget."
    },
    "experience": [
        {
            "role": "Operations Manager", "company": "Stink Studios",
            "start_date": "2022-07-01", "end_date": "2025-02-17",
            "description": "Lead and coordinate cross-functional teams across Buenos Aires office, improving project delivery rates by 15%\nManage resource allocation and budget planning for multiple concurrent projects\nImplement Agile methodologies to streamline production workflows\nServe as primary liaison between clients and internal teams",
        },
        {
            "role": "Producer", "company": "Draftline Buenos Aires (AB InBev)",
            "start_date": "2021-03-01", "end_date": "2022-07-01",
            "description": "Coordinated end-to-end production for 360° campaigns across multiple brands (Corona, Stella Artois)\nManaged budgets and timelines for digital and traditional media campaigns\nLed cross-functional teams of designers, copywriters and developers",
        },
        {
            "role": "Senior Producer / Product Manager", "company": "dift.co",
            "start_date": "2018-08-01", "end_date": "2021-03-01",
            "description": "Served as Product Manager for major brands including Netflix, XPL, and Filo.news\nLed development teams in delivering web and mobile products\nDefined product roadmaps and prioritized feature development",
        },
        {
            "role": "Post-Production Specialist", "company": "Cinequanon",
            "start_date": "2011-10-01", "end_date": "2016-03-01",
            "description": "Supervised VFX production on commercial shoots, ensuring technical specifications were met\nManaged post-production pipelines for broadcast commercials\nCoordinated with directors and agencies on creative deliverables",
        },
    ],
    "education": [
        {"degree": "Tech Developer Program", "institution": "Digital House", "start_date": "2021-03-01", "end_date": "2023-10-01", "description": ""},
        {"degree": "Bachelor's Degree in Radio and TV Production and Direction", "institution": "Universidad de Belgrano", "start_date": "2008-03-01", "end_date": "2012-12-01", "description": ""},
    ],
    "projects": [
        {
            "name": "Home Server Infrastructure",
            "description": "Design, implementation, and ongoing maintenance of personal home server using Proxmox VE hypervisor. Deployed multiple services through Virtual Machines and LXC containers. This project demonstrates practical knowledge of virtualization, containerization, networking, and system administration.",
            "link": "server-info.html",
        },
        {
            "name": "Portfolio Manager",
            "description": "Developed with the help of AI, a backend to manage all your information and manage different portfolios or CVs. Multi-Language and dark theme enabled.",
            "link": "https://github.com/martomarzo/personalwebsite",
        },
    ],
    "skills": [
        {"category": "Project Management", "name": "Budget management", "percentage": 96},
        {"category": "Project Management", "name": "Resource allocation", "percentage": 90},
        {"category": "Project Management", "name": "Risk mitigation", "percentage": 89},
        {"category": "Project Management", "name": "Timeline development", "percentage": 79},
        {"category": "Methodologies", "name": "Agile", "percentage": 90},
        {"category": "Methodologies", "name": "Scrum", "percentage": 89},
        {"category": "Programming", "name": "JavaScript", "percentage": 70},
        {"category": "Programming", "name": "HTML/CSS", "percentage": 60},
        {"category": "Programming", "name": "Python", "percentage": 50},
        {"category": "Design Software", "name": "Adobe After Effects", "percentage": 90},
        {"category": "Design Software", "name": "Adobe Premiere", "percentage": 88},
        {"category": "Design Software", "name": "Adobe Photoshop", "percentage": 60},
        {"category": "Soft Skills", "name": "Problem-solving", "percentage": 99},
        {"category": "Soft Skills", "name": "Team leadership", "percentage": 98},
        {"category": "Soft Skills", "name": "Cross-functional communication", "percentage": 97},
    ],
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/resume/slug/'):
            body = json.dumps(RESUME).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print(f'Mock preview server on http://localhost:{PORT}')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
