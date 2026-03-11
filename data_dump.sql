--
-- PostgreSQL database dump
--

\restrict OYNulLVZi7IXrSKwWFAtrGTCGDZHALsp0YVDNaKlbeilv2Go1yrZ4uYbHQO6IV8

-- Dumped from database version 17.6 (Debian 17.6-2.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Debian 17.6-2.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: resume_versions; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.resume_versions (id, name, title_experience, show_experience, title_education, show_education, title_projects, show_projects, title_skills, show_skills, title_summary, show_summary, title_experience_es, title_education_es, title_projects_es, title_skills_es, title_summary_es, slug) VALUES (2, 'DevOps', 'Experience', true, 'Education', true, 'Projects', true, 'Skills', true, 'Summary', true, 'Experiencia', 'Educación', 'Proyectos', 'Habilidades', 'Resumen', 'devops');
INSERT INTO public.resume_versions (id, name, title_experience, show_experience, title_education, show_education, title_projects, show_projects, title_skills, show_skills, title_summary, show_summary, title_experience_es, title_education_es, title_projects_es, title_skills_es, title_summary_es, slug) VALUES (1, 'PM', 'Experience', true, 'Education', true, 'Projects', false, 'Skills', true, 'Summary', true, 'Experiencia', 'Educación', 'Proyectos', 'Habilidades', 'Resumen', 'pm');


--
-- Data for Name: contact_info; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.contact_info (id, version_id, name, email, phone, linkedin, github, website, profile_picture, subtitle, subtitle_es) VALUES (2, 2, 'Martin Marzorati', 'hi@martomarzo.com', '+34614014399', 'https://www.linkedin.com/in/martinmarzorati/', 'https://github.com/martomarzo', '', NULL, 'Jr. DevOps', 'Jr. DevOps');
INSERT INTO public.contact_info (id, version_id, name, email, phone, linkedin, github, website, profile_picture, subtitle, subtitle_es) VALUES (1, 1, 'Martin Marzorati', 'hi@martomarzo.com', '+34614014399', 'https://www.linkedin.com/in/martinmarzorati/', 'https://github.com/martomarzo', 'https://www.about.martomarzo.com', NULL, 'Project Manager/Producer', 'Project Manager/Producer');


--
-- Data for Name: education; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.education (id, degree, institution, start_date, end_date, description, version_id) VALUES (2, 'DevOps Engineer Career Path', 'Microsoft Learn', '2025-04-01', NULL, '', 1);
INSERT INTO public.education (id, degree, institution, start_date, end_date, description, version_id) VALUES (3, 'Tech Developer Program', 'Digital House', '2021-03-01', '2023-10-01', '', 1);
INSERT INTO public.education (id, degree, institution, start_date, end_date, description, version_id) VALUES (4, 'Bachelor''s Degree in Radio and TV Production and Direction', 'Universidad de Belgrano', '2008-03-01', '2012-12-01', '', 1);


--
-- Data for Name: education_pool; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.education_pool (id, institution, start_date, end_date) VALUES (11, 'Universidad de Belgrano', '2008-02-29', '2012-11-30');
INSERT INTO public.education_pool (id, institution, start_date, end_date) VALUES (10, 'Digital House', '2021-02-28', '2023-09-30');
INSERT INTO public.education_pool (id, institution, start_date, end_date) VALUES (12, 'Microsoft Learn', '2025-03-31', NULL);
INSERT INTO public.education_pool (id, institution, start_date, end_date) VALUES (13, 'Boot.Dev', '2025-03-03', NULL);


--
-- Data for Name: education_details; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (20, 11, 'en', 'Bachelor''s Degree in Radio and TV Production and Direction', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (22, 11, 'es', 'Licenciatura en Dirección y Producción de Cine, TV y Radio', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (19, 10, 'en', 'Tech Developer Program', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (23, 10, 'es', 'Tech Developer Program', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (21, 12, 'en', 'DevOps Engineer Career Path', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (24, 12, 'es', 'DevOps Engineer Career Path', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (25, 13, 'en', 'Backend Path', '');
INSERT INTO public.education_details (id, pool_id, language, degree, description) VALUES (26, 13, 'es', 'Backend', '');


--
-- Data for Name: experience; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.experience (id, title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES (2, 'Operations Manager', 'Stink Studios', 'Buenos Aires / Remote', '2022-07-01', '2025-02-17', 'Lead and coordinate cross-functional teams across Buenos Aires office, improving project delivery rates by 15%
Develop and implement standardized workflows between Production and Creative departments, reducing delivery times by 20%
Establish technical requirements and specifications for client projects, ensuring alignment with business objectives
Manage resource allocation across multiple simultaneous projects, maintaining a 95% on-time delivery rate
Facilitate communication between technical and non-technical stakeholders to ensure project requirements are met', 'Ivan Faerman', 'ivan@stinkstudios.com', 1);
INSERT INTO public.experience (id, title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES (3, 'Senior Producer / Product Manager', 'dift.co', 'Buenos Aires, Argentina', '2018-08-01', '2021-03-01', 'Served as Product Manager for major brands including Netflix, XPL, and Filo.news
Designed and implemented technical workflows for the Filo.news content team, increasing output by 35%
Led development team in creating custom content management solutions for digital publishing
Coordinated teams for creation and distribution of audiovisual content, managing entire production pipeline
Applied coding knowledge to develop automation scripts that reduced post-production time by 25%', 'Ivan Faerman', '', 1);
INSERT INTO public.experience (id, title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES (4, 'Post-Production Specialist', 'Cinequanon', 'Buenos Aires, Argentina', '2011-10-01', '2016-03-01', 'Supervised VFX production on commercial shoots, ensuring technical specifications were met
Created motion graphics and animations using After Effects for national advertising campaigns
Developed custom scripts and macros to automate repetitive post-production tasks
Collaborated with directors to implement technical solutions for complex visual requirements', 'Sebastian Vega', 'sebastian@cinequanon.com.ar', 1);
INSERT INTO public.experience (id, title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES (6, 'Operations Manager', 'Stink studios', 'Buenos Aires/Remoto', '2022-07-01', '2025-02-01', 'Liderar y coordinar equipos multidisciplinarios en la oficina de Buenos Aires, mejorando los índices de entrega de proyectos en un 15%.
Desarrollar e implementar flujos de trabajo estandarizados entre los departamentos de Producción y Creatividad, reduciendo los tiempos de entrega en un 20%.
Establecer los requisitos y especificaciones técnicas para los proyectos de los clientes, asegurando su alineación con los objetivos comerciales.
Gestionar la asignación de recursos en múltiples proyectos simultáneos, manteniendo un índice de entrega a tiempo del 95%.
Facilitar la comunicación entre las partes interesadas, tanto técnicas como no técnicas, para asegurar que se cumplan los requisitos del proyecto.', 'Ivan Faerman', '', 2);
INSERT INTO public.experience (id, title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES (7, 'Productor Senior / Product Manager', 'dift.co', 'Buenos Aires, Argentina', '2018-09-01', '2021-03-01', 'Trabajé como gerente de producto para marcas importantes como Netflix, XPL y Filo.news.
Diseñé e implementé flujos de trabajo técnicos para el equipo de contenido de Filo.news, lo que incrementó la producción en un 35 %.
Lideré el equipo de desarrollo en la creación de soluciones personalizadas de gestión de contenido para la publicación digital.
Coordiné equipos para la creación y distribución de contenido audiovisual, gestionando todo el proceso de producción.
Apliqué mis conocimientos de programación para desarrollar scripts de automatización que redujeron el tiempo de postproducción en un 25 %.', 'Ivan Faerman', '', 2);
INSERT INTO public.experience (id, title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES (5, 'Productor', 'Draftline Buenos Aires (AB InBev)', 'Buenos Aires', '2021-03-01', '2022-07-01', 'Coordinated end-to-end production for 360° campaigns across multiple brands (Corona, Stella Artois)
Managed budgets exceeding $500K while meeting all project deadlines and quality benchmarks
Supervised external suppliers for product shooting, negotiating favorable terms that reduced costs by 12%
Implemented technical solutions to streamline content approval processes, reducing feedback cycles by 30%
Collaborated with development teams to integrate campaign materials with digital platforms', 'Sebastian Torrela', 'sebastor@quilmes.com.ar', 2);


--
-- Data for Name: experience_pool; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.experience_pool (id, company, start_date, end_date) VALUES (26, 'Stink Studios', '2022-07-01', '2025-02-17');
INSERT INTO public.experience_pool (id, company, start_date, end_date) VALUES (28, 'dift.co', '2018-08-01', '2021-03-01');
INSERT INTO public.experience_pool (id, company, start_date, end_date) VALUES (30, 'Draftline Buenos Aires (AB InBev)', '2021-02-27', '2022-06-29');
INSERT INTO public.experience_pool (id, company, start_date, end_date) VALUES (25, 'Cinequanon', '2011-09-29', '2016-02-28');


--
-- Data for Name: experience_details; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (82, 26, 'en', 'Operations Manager', 'Lead and coordinate cross-functional teams across Buenos Aires office, improving project delivery rates by 15%
Develop and implement standardized workflows between Production and Creative departments, reducing delivery times by 20%
Establish technical requirements and specifications for client projects, ensuring alignment with business objectives
Manage resource allocation across multiple simultaneous projects, maintaining a 95% on-time delivery rate
Facilitate communication between technical and non-technical stakeholders to ensure project requirements are met');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (85, 26, 'es', 'Operations Manager', 'Liderar y coordinar equipos multidisciplinarios en la oficina de Buenos Aires, mejorando los índices de entrega de proyectos en un 15%.
Desarrollar e implementar flujos de trabajo estandarizados entre los departamentos de Producción y Creatividad, reduciendo los tiempos de entrega en un 20%.
Establecer los requisitos y especificaciones técnicas para los proyectos de los clientes, asegurando su alineación con los objetivos comerciales.
Gestionar la asignación de recursos en múltiples proyectos simultáneos, manteniendo un índice de entrega a tiempo del 95%.
Facilitar la comunicación entre las partes interesadas, tanto técnicas como no técnicas, para asegurar que se cumplan los requisitos del proyecto.');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (83, 28, 'en', 'Senior Producer / Product Manager', 'Served as Product Manager for major brands including Netflix, XPL, and Filo.news
Designed and implemented technical workflows for the Filo.news content team, increasing output by 35%
Led development team in creating custom content management solutions for digital publishing
Coordinated teams for creation and distribution of audiovisual content, managing entire production pipeline
Applied coding knowledge to develop automation scripts that reduced post-production time by 25%');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (89, 28, 'es', 'Senior Producer / Product Manager', 'Trabajé como gerente de producto para marcas importantes como Netflix, XPL y Filo.news.
Diseñé e implementé flujos de trabajo técnicos para el equipo de contenido de Filo.news, lo que incrementó la producción en un 35 %.
Lideré el equipo de desarrollo en la creación de soluciones personalizadas de gestión de contenido para la publicación digital.
Coordiné equipos para la creación y distribución de contenido audiovisual, gestionando todo el proceso de producción.
Apliqué mis conocimientos de programación para desarrollar scripts de automatización que redujeron el tiempo de postproducción en un 25 %.');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (90, 30, 'en', 'Producer', 'Coordinated end-to-end production for 360° campaigns across multiple brands (Corona, Stella Artois)
Managed budgets exceeding $500K while meeting all project deadlines and quality benchmarks
Supervised external suppliers for product shooting, negotiating favorable terms that reduced costs by 12%
Implemented technical solutions to streamline content approval processes, reducing feedback cycles by 30%
Collaborated with development teams to integrate campaign materials with digital platforms');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (88, 30, 'es', 'Productor', 'Coordiné la producción integral de campañas 360° para múltiples marcas (Corona, Stella Artois).

Gestioné presupuestos superiores a $500.000, cumpliendo con todos los plazos del proyecto y los estándares de calidad.

Supervisé a proveedores externos para las sesiones de fotos y video de productos, negociando condiciones favorables que redujeron los costos en un 12%.

Implementé soluciones técnicas para optimizar los procesos de aprobación de contenido, logrando reducir los ciclos de revisión en un 30%.

Colaboré con los equipos de desarrollo para integrar los materiales de la campaña en las plataformas digitales.');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (81, 25, 'en', 'Post-Production Specialist', 'Supervised VFX production on commercial shoots, ensuring technical specifications were met
Created motion graphics and animations using After Effects for national advertising campaigns
Developed custom scripts and macros to automate repetitive post-production tasks
Collaborated with directors to implement technical solutions for complex visual requirements');
INSERT INTO public.experience_details (id, pool_id, language, role, description) VALUES (91, 25, 'es', 'Supervisor de Post-Produccion', 'Supervisé la producción de efectos visuales (VFX) en rodajes comerciales, garantizando el cumplimiento de las especificaciones técnicas.

Creé motion graphics y animaciones utilizando After Effects para campañas publicitarias a nivel nacional.

Desarrollé scripts y macros personalizados para automatizar tareas repetitivas de postproducción.

Colaboré con directores para implementar soluciones técnicas ante requisitos visuales complejos.');


--
-- Data for Name: project_pool; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.project_pool (id, link) VALUES (3, 'server-info.html');
INSERT INTO public.project_pool (id, link) VALUES (4, 'https://github.com/martomarzo/personalwebsite');


--
-- Data for Name: project_details; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.project_details (id, pool_id, language, name, description) VALUES (4, 3, 'en', 'Home Server Infrastructure', 'Design, implementation, and ongoing maintenance of personal home server using Proxmox VE hypervisor. Deployed multiple services through Virtual Machines and LXC containers. This project demonstrates practical knowledge of virtualization, containerization, networking, and system administration.');
INSERT INTO public.project_details (id, pool_id, language, name, description) VALUES (5, 3, 'es', 'Servidor Local', 'Diseñé, implementé y mantuve un servidor doméstico personal utilizando el hipervisor Proxmox VE.

Desplegué múltiples servicios a través de máquinas virtuales (VMs) y contenedores LXC.

Apliqué conocimientos prácticos en virtualización, contenerización, redes y administración de sistemas.');
INSERT INTO public.project_details (id, pool_id, language, name, description) VALUES (6, 4, 'en', 'Porfolio Manager', 'Developed with the help of AI, a backend to manage all your information and manage different porfolios or CVs. Multi-Language and dark theme enabled');
INSERT INTO public.project_details (id, pool_id, language, name, description) VALUES (7, 4, 'es', 'Manager de Curriculums', '');


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.projects (id, title, description, link, icon, version_id) VALUES (3, 'Home Server Infrastructure', 'Design, implementation, and ongoing maintenance of personal home server using Proxmox VE hypervisor. Deployed multiple services through Virtual Machines and LXC containers. This project demonstrates practical knowledge of virtualization, containerization, networking, and system administration.', 'https://www.about.martomarzo.com/server-info', '', 1);


--
-- Data for Name: skill_categories; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.skill_categories (id, name) VALUES (1, 'Programming');
INSERT INTO public.skill_categories (id, name) VALUES (2, 'Methodologies');
INSERT INTO public.skill_categories (id, name) VALUES (3, 'Project Management');
INSERT INTO public.skill_categories (id, name) VALUES (4, 'Design Software');
INSERT INTO public.skill_categories (id, name) VALUES (5, 'Soft Skills');
INSERT INTO public.skill_categories (id, name) VALUES (6, 'DevOps');


--
-- Data for Name: skill_pool; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (25, 90, 'Design Software', 4);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (27, 88, 'Design Software', 4);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (28, 90, 'Methodologies', 2);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (29, 89, 'Methodologies', 2);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (30, 60, 'Programming', 1);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (31, 70, 'Programming', 1);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (32, 50, 'Programming', 1);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (33, 96, 'Project Management', 3);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (34, 90, 'Project Management', 3);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (35, 89, 'Project Management', 3);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (36, 79, 'Project Management', 3);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (37, 97, 'Soft Skills', 5);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (38, 99, 'Soft Skills', 5);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (39, 98, 'Soft Skills', 5);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (26, 60, 'Design Software', 4);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (40, 60, 'Technical Expertise', 6);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (41, 70, 'Technical Expertise', 6);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (42, 60, 'Technical Expertise', 6);
INSERT INTO public.skill_pool (id, percentage, category, category_id) VALUES (43, 50, 'Technical Expertise', 6);


--
-- Data for Name: skill_details; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (46, 25, 'en', 'Adobe After Effects');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (47, 25, 'es', 'Adobe After Effects');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (50, 27, 'en', 'Adobe Premiere');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (51, 27, 'es', 'Adobe Premiere');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (52, 28, 'en', 'Agile');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (53, 28, 'es', 'Agile');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (54, 29, 'en', 'Scrum');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (55, 29, 'es', 'Scrum');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (56, 30, 'en', 'HTML/CSS');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (57, 30, 'es', 'HTML/CSS');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (58, 31, 'en', 'JavaScript');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (59, 31, 'es', 'JavaScript');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (60, 32, 'en', 'Python');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (61, 32, 'es', 'Python');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (62, 33, 'en', 'Budget management');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (63, 33, 'es', 'Budget management');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (64, 34, 'en', 'Resource allocation');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (65, 34, 'es', 'Resource allocation');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (66, 35, 'en', 'Risk mitigation');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (67, 35, 'es', 'Risk mitigation');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (68, 36, 'en', 'Timeline development');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (69, 36, 'es', 'Timeline development');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (70, 37, 'en', 'Cross-functional communication');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (71, 37, 'es', 'Cross-functional communication');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (72, 38, 'en', 'Problem-solving');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (73, 38, 'es', 'Problem-solving');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (74, 39, 'en', 'Team leadership');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (75, 39, 'es', 'Team leadership');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (48, 26, 'en', 'Adobe Photoshop');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (49, 26, 'es', 'Adobe Photoshop');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (76, 40, 'en', 'Docker');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (77, 40, 'es', 'Docker');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (78, 41, 'en', 'Linux System Administration');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (79, 41, 'es', 'Linux System Administration');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (80, 42, 'en', 'Networking & API Integration');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (81, 42, 'es', 'Networking & API Integration');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (82, 43, 'en', 'NFS/SMB');
INSERT INTO public.skill_details (id, pool_id, language, name) VALUES (83, 43, 'es', 'NFS/SMB');


--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.skills (id, category, name, level, version_id) VALUES (1, 'Programming', 'JavaScript', 70, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (2, 'Programming', 'Python', 50, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (3, 'Programming', 'HTML/CSS', 60, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (4, 'Design Software', 'Adobe Premiere', 88, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (5, 'Design Software', 'Adobe After Effects', 90, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (6, 'Design Software', 'Adobe Photoshop', 60, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (7, 'Project Management', 'Resource allocation', 90, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (8, 'Project Management', 'Budget management', 96, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (9, 'Project Management', 'Timeline development', 79, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (10, 'Project Management', 'Risk mitigation', 89, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (11, 'Methodologies', 'Agile', 90, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (12, 'Methodologies', 'Scrum', 89, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (13, 'Soft Skills', 'Team leadership', 98, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (14, 'Soft Skills', 'Cross-functional communication', 97, 1);
INSERT INTO public.skills (id, category, name, level, version_id) VALUES (15, 'Soft Skills', 'Problem-solving', 99, 1);


--
-- Data for Name: summary; Type: TABLE DATA; Schema: public; Owner: api_user
--



--
-- Data for Name: summary_pool; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.summary_pool (id) VALUES (1);
INSERT INTO public.summary_pool (id) VALUES (2);


--
-- Data for Name: summary_details; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.summary_details (id, pool_id, language, content) VALUES (1, 1, 'eng', 'I am the best of the world');
INSERT INTO public.summary_details (id, pool_id, language, content) VALUES (2, 1, 'esp', 'Soy el mejor del mundo');
INSERT INTO public.summary_details (id, pool_id, language, content) VALUES (3, 1, 'en', 'Detail-oriented Project Manager with 7+ years of experience leading cross-functional teams in digital media and tech environments. Combines strong technical background in software development with exceptional leadership skills. Proficient in multiple programming languages and experienced in maintaining server infrastructure. Skilled at optimizing workflows and delivering complex projects on time and within budget.');
INSERT INTO public.summary_details (id, pool_id, language, content) VALUES (4, 1, 'es', 'Project Manager orientado al detalle con más de 7 años de experiencia liderando equipos multidisciplinares en medios digitales y entornos tecnológicos. Combina una sólida base técnica en desarrollo de software con excepcionales habilidades de liderazgo. Competente en múltiples lenguajes de programación y con experiencia en el mantenimiento de infraestructura de servidores. Experto en optimizar flujos de trabajo y entregar proyectos complejos a tiempo y dentro del presupuesto.');
INSERT INTO public.summary_details (id, pool_id, language, content) VALUES (5, 2, 'en', 'Self-taught DevOps Jr. Engineer with hands-on experience architecting and managing self-hosted infrastructure across a 3-node Proxmox VE cluster. I specialize in deploying scalable microservices via Linux Containers (LXC) and Docker Compose, ensuring seamless remote integration and secure networking between distributed nodes. My infrastructure expertise extends to advanced storage engineering, configuring OpenMediaVault (OMV) to provision robust NFS and SMB shares across the network. Additionally, I utilize MergerFS to seamlessly aggregate mixed-capacity physical drives into unified, non-destructive storage pools for highly available, network-attached services.

Passionate about automation and system integration, I have engineered complex, state-based automated workflows using Home Assistant and YAML to unify diverse platforms like Jellyfin and Music Assistant. I am proficient in troubleshooting web server routing, resolving strict OAuth authentication flows via third-party APIs, and executing automated cross-node file deployments via rsync and SSH. I continuously leverage deep analytical skills to solve complex deployment challenges, from resolving mDNS multicast discovery across subnets to managing strict container permission boundaries (UID/GID mapping) and container-to-host storage bridging.');
INSERT INTO public.summary_details (id, pool_id, language, content) VALUES (6, 2, 'es', 'Ingeniero DevOps Jr. autodidacta con experiencia práctica en el diseño y la gestión de infraestructura autohospedada en un clúster Proxmox VE de 3 nodos. Me especializo en el despliegue de microservicios escalables mediante contenedores Linux (LXC) y Docker Compose, garantizando una integración remota fluida y redes seguras entre nodos distribuidos. Mi experiencia en infraestructura se extiende a la ingeniería de almacenamiento avanzado, configurando OpenMediaVault (OMV) para provisionar recursos compartidos NFS y SMB robustos en la red. Además, utilizo MergerFS para agrupar sin problemas unidades físicas de distintas capacidades en pools de almacenamiento unificados y no destructivos para servicios de alta disponibilidad conectados en red.

Apasionado por la automatización y la integración de sistemas, he diseñado flujos de trabajo automatizados complejos y basados en estados utilizando Home Assistant y YAML para unificar diversas plataformas como Jellyfin y Music Assistant. Soy competente en la resolución de problemas de enrutamiento de servidores web, la resolución de flujos estrictos de autenticación OAuth a través de APIs de terceros y la ejecución de despliegues automatizados de archivos entre nodos mediante rsync y SSH. Aprovecho continuamente mis profundas habilidades analíticas para resolver desafíos complejos de despliegue, desde la resolución del descubrimiento multicast mDNS entre subredes hasta la gestión de límites estrictos de permisos en contenedores (mapeo UID/GID) y la conexión de almacenamiento entre el contenedor y el host.');


--
-- Data for Name: version_education_visibility; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (1, 10, true);
INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (1, 11, true);
INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (2, 11, true);
INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (2, 10, true);
INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (2, 12, true);
INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (1, 12, false);
INSERT INTO public.version_education_visibility (version_id, pool_id, is_visible) VALUES (2, 13, true);


--
-- Data for Name: version_experience_visibility; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (1, 25, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (2, 28, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (1, 26, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (1, 28, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (2, 26, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (2, 25, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (1, 30, true);
INSERT INTO public.version_experience_visibility (version_id, pool_id, is_visible) VALUES (2, 30, false);


--
-- Data for Name: version_project_visibility; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.version_project_visibility (version_id, pool_id, is_visible) VALUES (2, 3, true);
INSERT INTO public.version_project_visibility (version_id, pool_id, is_visible) VALUES (1, 4, false);
INSERT INTO public.version_project_visibility (version_id, pool_id, is_visible) VALUES (1, 3, false);
INSERT INTO public.version_project_visibility (version_id, pool_id, is_visible) VALUES (2, 4, true);


--
-- Data for Name: version_skill_visibility; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 25, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 26, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 27, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 28, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 28, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 29, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 29, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 30, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 30, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 31, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 31, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 32, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 33, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 33, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 34, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 34, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 35, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 35, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 36, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 36, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 37, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 37, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 38, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 38, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 39, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 39, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 26, false);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 25, false);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 27, false);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (1, 32, false);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 40, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 41, true);
INSERT INTO public.version_skill_visibility (version_id, pool_id, is_visible) VALUES (2, 43, true);


--
-- Data for Name: version_summary_visibility; Type: TABLE DATA; Schema: public; Owner: api_user
--

INSERT INTO public.version_summary_visibility (version_id, pool_id, is_visible) VALUES (1, 1, true);
INSERT INTO public.version_summary_visibility (version_id, pool_id, is_visible) VALUES (2, 2, true);
INSERT INTO public.version_summary_visibility (version_id, pool_id, is_visible) VALUES (2, 1, false);


--
-- Name: contact_info_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.contact_info_id_seq', 4, true);


--
-- Name: education_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.education_details_id_seq', 26, true);


--
-- Name: education_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.education_id_seq', 4, true);


--
-- Name: education_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.education_pool_id_seq', 13, true);


--
-- Name: experience_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.experience_details_id_seq', 91, true);


--
-- Name: experience_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.experience_id_seq', 7, true);


--
-- Name: experience_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.experience_pool_id_seq', 30, true);


--
-- Name: project_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.project_details_id_seq', 7, true);


--
-- Name: project_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.project_pool_id_seq', 4, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.projects_id_seq', 3, true);


--
-- Name: resume_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.resume_versions_id_seq', 4, true);


--
-- Name: skill_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.skill_categories_id_seq', 6, true);


--
-- Name: skill_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.skill_details_id_seq', 83, true);


--
-- Name: skill_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.skill_pool_id_seq', 43, true);


--
-- Name: skills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.skills_id_seq', 15, true);


--
-- Name: summary_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.summary_details_id_seq', 6, true);


--
-- Name: summary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.summary_id_seq', 1, false);


--
-- Name: summary_pool_id_seq; Type: SEQUENCE SET; Schema: public; Owner: api_user
--

SELECT pg_catalog.setval('public.summary_pool_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict OYNulLVZi7IXrSKwWFAtrGTCGDZHALsp0YVDNaKlbeilv2Go1yrZ4uYbHQO6IV8

