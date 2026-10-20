const test = require('node:test');
const assert = require('node:assert/strict');
const { buildResumeHtml, buildCoverLetterHtml, resumeFilename } = require('./templates');

const PUBLIC_URL = 'https://cv.example.com';

function fullResume(overrides = {}) {
    const version = {
        id: 1,
        name: 'PM',
        slug: 'pm',
        contact_name: 'Martín Marzorati',
        subtitle: 'Project Manager / Producer',
        email: 'hi@martomarzo.com',
        phone: '+34 614 01 43 99',
        linkedin: 'https://www.linkedin.com/in/martinmarzorati/',
        github: 'https://github.com/martomarzo',
        website: 'https://www.about.martomarzo.com',
        title_summary: 'Professional Summary', show_summary: true,
        title_experience: 'Professional Experience', show_experience: true,
        title_skills: 'Skills & Tools', show_skills: true,
        title_projects: 'Personal Projects', show_projects: true,
        title_education: 'Education', show_education: true,
        ...(overrides.version || {}),
    };
    return {
        version,
        summary: { id: 1, content: 'Line one of the summary.\nLine two.' },
        experience: [
            {
                pool_id: 10, company: 'Acme', role: 'Operations Manager',
                start_date: '2019-08-01', end_date: null,
                description: 'Led teams\nShipped things\nCut costs by 15%',
            },
            {
                pool_id: 11, company: 'Globex', role: 'Producer',
                start_date: new Date(2018, 0, 1), end_date: new Date('2019-07-01T00:00:00.000Z'),
                description: 'Single line description.',
            },
        ],
        education: [
            { degree: 'BA Media', institution: 'Universidad de Belgrano', start_date: '2008-03-01', end_date: '2012-12-01', description: '' },
        ],
        projects: [
            { name: 'Home Server', description: 'Proxmox homelab.', link: 'server-info.html' },
            { name: 'Portfolio', description: 'This site.', link: 'https://github.com/martomarzo/personalwebsite' },
        ],
        skills: [
            { id: 1, name: 'Agile', category: 'Methodologies', percentage: 90 },
            { id: 2, name: 'Scrum', category: 'Methodologies', percentage: 80 },
            { id: 3, name: 'JavaScript', category: 'Programming', percentage: 70 },
        ],
        ...overrides.sections,
    };
}

// Visible text of an HTML document: drop <head>, tags, decode the few entities we emit.
function textOf(html) {
    return html
        .replace(/<head[\s\S]*?<\/head>/i, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');
}

const EMPTY_ELEMENT = /<(li|p|ul|ol|section|h1|h2|h3|span|a|div|dt|dd|dl|header|time)\b[^>]*>\s*<\/\1>/;

test('resume shows email, phone and LinkedIn as visible, clickable text', () => {
    const html = buildResumeHtml(fullResume(), { language: 'en', publicUrl: PUBLIC_URL });
    const text = textOf(html);
    assert.ok(text.includes('hi@martomarzo.com'));
    assert.ok(text.includes('+34 614 01 43 99'), 'phone displayed as stored');
    assert.ok(text.includes('linkedin.com/in/martinmarzorati'));
    assert.ok(!text.includes('https://www.linkedin.com'), 'LinkedIn shown without scheme/www');
    assert.ok(text.includes('github.com/martomarzo'));
    assert.ok(text.includes('about.martomarzo.com'));
    assert.match(html, /href="mailto:hi@martomarzo\.com"/);
    assert.match(html, /href="https:\/\/wa\.me\/34614014399"/);
    assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/martinmarzorati\/"/);
});

test('relative project links become absolute; server-info carries the version slug', () => {
    const html = buildResumeHtml(fullResume(), { language: 'en', publicUrl: PUBLIC_URL + '/' });
    assert.match(html, /href="https:\/\/cv\.example\.com\/server-info\.html\?from=pm"/);
    assert.match(html, /href="https:\/\/github\.com\/martomarzo\/personalwebsite"/);
    assert.ok(!/href="server-info\.html/.test(html), 'no relative hrefs left');
    assert.ok(!html.includes('127.0.0.1'));
});

test('English labels and dates', () => {
    const html = buildResumeHtml(fullResume(), { language: 'en', publicUrl: PUBLIC_URL });
    const text = textOf(html);
    assert.match(html, /<html lang="en"/);
    assert.ok(text.includes('Aug 2019 – Present'));
    assert.ok(text.includes('Jan 2018 – Jul 2019'), 'Date objects and ISO strings keep their calendar month');
    assert.ok(text.includes('Professional Experience'), 'uses the version title');
    assert.match(html, /<title>Martín Marzorati — CV<\/title>/);
});

test('Spanish labels and dates', () => {
    const resume = fullResume({ version: { title_experience: null, title_summary: '' } });
    const html = buildResumeHtml(resume, { language: 'es', publicUrl: PUBLIC_URL });
    const text = textOf(html);
    assert.match(html, /<html lang="es"/);
    assert.ok(text.includes('Ago 2019 – Actualidad'));
    assert.ok(text.includes('Ene 2018 – Jul 2019'));
    assert.ok(!text.includes('Present'));
    assert.ok(text.includes('Experiencia'), 'falls back to the Spanish default title');
    assert.ok(text.includes('Resumen'));
    assert.match(html, /<title>Martín Marzorati — Currículum<\/title>/);
});

test('YYYY-MM-DD dates do not drift in a negative-offset timezone', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'America/Argentina/Buenos_Aires';
    try {
        const resume = fullResume();
        resume.experience = [{ pool_id: 1, company: 'X', role: 'Y', start_date: '2018-01-01', end_date: '2020-12-01', description: '' }];
        const text = textOf(buildResumeHtml(resume, { language: 'en', publicUrl: PUBLIC_URL }));
        assert.ok(text.includes('Jan 2018 – Dec 2020'), text);
    } finally {
        if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
    }
});

test('interpolated text is escaped', () => {
    const resume = fullResume();
    resume.experience[0].role = 'R&D <Lead> "Ops"';
    resume.experience[0].description = 'Used <script>alert(1)</script> & "quotes"\nSecond \'line\'';
    resume.projects[1].name = 'A<b>B';
    const html = buildResumeHtml(resume, { language: 'en', publicUrl: PUBLIC_URL });
    assert.ok(html.includes('R&amp;D &lt;Lead&gt; &quot;Ops&quot;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;'));
    assert.ok(html.includes('Second &#39;line&#39;'));
    assert.ok(html.includes('A&lt;b&gt;B'));
});

test('multi-line descriptions become bullets, single lines a paragraph', () => {
    const html = buildResumeHtml(fullResume(), { language: 'en', publicUrl: PUBLIC_URL });
    assert.match(html, /<li>Led teams<\/li>\s*<li>Shipped things<\/li>/);
    assert.match(html, /<p[^>]*>Single line description\.<\/p>/);
});

test('sparse data produces no empty elements or headings', () => {
    const resume = fullResume({
        version: { phone: null, github: '', website: undefined, title_skills: 'Technical Skills', title_projects: 'Side Projects' },
        sections: { skills: [], projects: [], summary: null },
    });
    resume.experience[0].description = '';
    resume.experience[1].description = null;
    resume.education[0].start_date = null;
    resume.education[0].end_date = null;
    const html = buildResumeHtml(resume, { language: 'en', publicUrl: PUBLIC_URL });
    const text = textOf(html);
    assert.ok(!html.includes('wa.me'));
    assert.ok(!text.toLowerCase().includes('github'));
    assert.ok(!html.includes('<img'), 'no photo element without photoDataUri');
    assert.ok(!text.includes('Technical Skills'));
    assert.ok(!text.includes('Side Projects'));
    assert.ok(!text.includes('Professional Summary'));
    assert.ok(!/·\s*·/.test(text), 'no doubled separators');
    assert.doesNotMatch(html, EMPTY_ELEMENT);
    assert.ok(text.includes('Operations Manager'));
});

test('show_* flags hide sections even if data is present', () => {
    const resume = fullResume({ version: { show_skills: false, show_education: false } });
    const text = textOf(buildResumeHtml(resume, { language: 'en', publicUrl: PUBLIC_URL }));
    assert.ok(!text.includes('Skills & Tools'));
    assert.ok(!text.includes('Universidad de Belgrano'));
});

test('photo is embedded when a data URI is given', () => {
    const html = buildResumeHtml(fullResume(), { language: 'en', publicUrl: PUBLIC_URL, photoDataUri: 'data:image/jpeg;base64,AAAA' });
    assert.match(html, /<img[^>]+src="data:image\/jpeg;base64,AAAA"/);
});

test('skills are grouped by category without percentages', () => {
    const text = textOf(buildResumeHtml(fullResume(), { language: 'en', publicUrl: PUBLIC_URL }));
    assert.ok(text.includes('Methodologies'));
    assert.ok(text.includes('Agile, Scrum'));
    assert.ok(!text.includes('90%'));
});

test('resumeFilename folds accents and falls back without a name', () => {
    assert.equal(resumeFilename('Martín Marzorati', 'es'), 'Martin-Marzorati-CV-ES.pdf');
    assert.equal(resumeFilename('Martin Marzorati', 'en'), 'Martin-Marzorati-CV-EN.pdf');
    assert.equal(resumeFilename('  Ana  María Núñez ', 'en'), 'Ana-Maria-Nunez-CV-EN.pdf');
    assert.equal(resumeFilename('', 'en'), 'CV-EN.pdf');
    assert.equal(resumeFilename(null, 'es'), 'CV-ES.pdf');
    assert.equal(resumeFilename(undefined), 'CV-EN.pdf');
});

const LETTER = {
    text: 'First paragraph.\nStill first.\n\nSecond <paragraph> & more.',
    candidateName: 'Martín Marzorati',
    subtitle: 'Project Manager',
    email: 'hi@martomarzo.com',
    phone: '+34614014399',
    linkedin: 'https://www.linkedin.com/in/martinmarzorati/',
    website: 'https://about.martomarzo.com',
    cvUrl: 'https://about.martomarzo.com/?v=acme-pm',
    companyName: 'Acme & Co',
};

test('cover letter in Spanish: greeting, closing, date', () => {
    const html = buildCoverLetterHtml({ ...LETTER, language: 'es' });
    const text = textOf(html);
    assert.match(html, /<html lang="es"/);
    assert.ok(text.includes('Equipo de Contratación en Acme & Co,'));
    assert.ok(html.includes('Acme &amp; Co'));
    assert.ok(text.includes('Atentamente,'));
    assert.match(text, /\d{1,2} de [a-záéíóú]+ de \d{4}/);
});

test('cover letter in English: greeting, closing, body, contact line', () => {
    const html = buildCoverLetterHtml({ ...LETTER, language: 'en' });
    const text = textOf(html);
    assert.ok(text.includes('Hiring Team at Acme & Co,'));
    assert.ok(text.includes('Sincerely,'));
    assert.equal((html.match(/<p class="para">/g) || []).length, 2);
    assert.ok(html.includes('Second &lt;paragraph&gt; &amp; more.'));
    assert.ok(text.includes('hi@martomarzo.com'));
    assert.ok(text.includes('linkedin.com/in/martinmarzorati'));
    assert.ok(text.includes('CV: about.martomarzo.com/?v=acme-pm'));
    assert.match(html, /href="https:\/\/wa\.me\/34614014399"/);
    assert.ok(!html.includes('<img'));
});

test('cover letter without company or optional contacts', () => {
    const html = buildCoverLetterHtml({ text: 'Hello.', candidateName: 'Ana', email: 'a@b.c', language: 'en' });
    const text = textOf(html);
    assert.ok(!text.includes('Hiring Team at'));
    assert.ok(!html.includes('wa.me'));
    assert.ok(!text.includes('CV:'));
    assert.doesNotMatch(html, EMPTY_ELEMENT);
});
