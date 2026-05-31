const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const PROVIDER_NAME = 'anthropic';

const SYSTEM_PROMPT = `You tailor resumes for specific job applications.

Given a candidate's resume (experience entries, skills, optional summary) and a target job description, you produce:
1. Rewritten descriptions for each experience entry, emphasizing JD-relevant work.
2. A rewritten summary that frames the candidate for this role.
3. A subset of EXISTING skill pool IDs to display (hide skills that are irrelevant to this role).
4. Optionally, new skills that are evidenced in the candidate's existing experience but missing from the skill pool.
5. A suggested slug and human-readable name for the new resume version.

Guidelines:
- Stay truthful. Reframe existing content; do not invent experience, accomplishments, tools, or proficiency the candidate has not demonstrated.
- Write in a natural, human voice — assume an AI-detection scan. Avoid clichéd LLM phrasing ("delve", "leverage", "tapestry", "navigate complexities", "in today's fast-paced...", "moreover", "furthermore", "it's worth noting that...", "robust solution", "seamlessly"). Vary sentence length and rhythm; don't over-balance every sentence into perfect parallel structure. Use commas and periods over em-dashes. Prefer plain, direct word choices over corporate buzzwords. Real people don't write three-clause sentences that all start with present participles.
- Each experience description should be 2-5 short bullet-style lines separated by newlines (one bullet per line, no leading dash or asterisk).
- Write tailored experience and summary in the input language (English when language="en", Spanish when language="es"). Do not translate.
- Keep the tone professional and concrete; emphasize measurable outcomes where the original mentions them.
- Do not change role titles, company names, dates, or skill names.
- For skills_visible: include only skill pool IDs (from the provided skills list) that are relevant to this role. Prefer a focused list over showing every skill.
- For new_skills: ONLY suggest a skill if it is clearly evidenced in the candidate's existing experience descriptions or summary AND it is relevant to the target JD AND it is not already in the existing skills list. Cap at 5 suggestions. Skip this entirely if nothing qualifies — quality over quantity.
  - Provide both name_en (English) and name_es (Spanish). Most technical skills (e.g. "PostgreSQL", "Docker") have the same name in both; soft skills and concepts often differ ("Project Management" / "Gestión de Proyectos").
  - Match category to one of the existing categories provided. If no existing category fits well, use the closest match — do not invent new categories.
  - evidence is a short string (one short sentence) explaining which experience entry surfaces this skill (e.g. "Mentioned working with Postgres schemas at Acme.").
- For suggested_slug: lowercase, hyphens only, short and descriptive (e.g. "acme-corp-eng", "google-pm-2026"). No spaces or special characters.
- For suggested_name: short human-readable title (e.g. "Acme Corp - Engineering", "Google PM").`;

const TAILOR_SCHEMA = {
    type: 'object',
    properties: {
        experience: {
            type: 'array',
            description: 'Tailored description per existing experience entry, keyed by pool_id.',
            items: {
                type: 'object',
                properties: {
                    pool_id: { type: 'integer' },
                    description: { type: 'string' },
                },
                required: ['pool_id', 'description'],
                additionalProperties: false,
            },
        },
        summary: {
            type: 'string',
            description: 'Tailored summary text for the new version.',
        },
        skills_visible: {
            type: 'array',
            description: 'Pool IDs of skills to keep visible on the tailored version (from the existing skills list).',
            items: { type: 'integer' },
        },
        new_skills: {
            type: 'array',
            description: 'Skills evidenced in the candidate experience but missing from the existing pool. Empty array if nothing qualifies.',
            items: {
                type: 'object',
                properties: {
                    name_en: { type: 'string' },
                    name_es: { type: 'string' },
                    category: { type: 'string' },
                    evidence: { type: 'string' },
                },
                required: ['name_en', 'name_es', 'category', 'evidence'],
                additionalProperties: false,
            },
        },
        suggested_slug: { type: 'string' },
        suggested_name: { type: 'string' },
        cover_letter: {
            type: 'string',
            description: 'Cover letter body text. Only include this field when the user requested a cover letter. Omit otherwise.',
        },
    },
    required: ['experience', 'summary', 'skills_visible', 'new_skills', 'suggested_slug', 'suggested_name'],
    additionalProperties: false,
};

function getClient() {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set. Add it to backend/.env to enable AI tailoring.');
    }
    return new Anthropic();
}

// Deterministic serialization so the canonical block hashes identically across calls
// (cache reuse depends on byte-identical prefixes).
function buildCanonicalBlock(baseResume, language) {
    const experience = (baseResume.experience || [])
        .slice()
        .sort((a, b) => a.pool_id - b.pool_id)
        .map(e => ({
            pool_id: e.pool_id,
            company: e.company,
            role: e.role,
            start_date: e.start_date || null,
            end_date: e.end_date || null,
            description: e.description || '',
        }));

    const skills = (baseResume.skills || [])
        .slice()
        .sort((a, b) => a.id - b.id)
        .map(s => ({ pool_id: s.id, name: s.name, category: s.category }));

    const summary = baseResume.summary ? baseResume.summary.content : null;

    return [
        `Language: ${language}`,
        '',
        'Experience entries (canonical, in pool_id order):',
        JSON.stringify(experience, null, 2),
        '',
        'Skills available (canonical, in pool_id order):',
        JSON.stringify(skills, null, 2),
        '',
        'Current summary:',
        summary ? JSON.stringify(summary) : '(none)',
    ].join('\n');
}

function buildJobBlock(jobDescription, companyName) {
    return [
        companyName ? `Target company: ${companyName}` : 'Target company: (not specified)',
        '',
        'Job description:',
        jobDescription,
    ].join('\n');
}

function buildCoverLetterBlock(include, candidateName) {
    if (!include) return 'Cover letter: DO NOT GENERATE. Omit the cover_letter field from your output.';
    return [
        'Cover letter: GENERATE.',
        `Write a 3-paragraph cover letter (~250-350 words total) addressed to the hiring team for this role.`,
        `- Tone: professional yet friendly — warm without being casual.`,
        `- Paragraph 1: open with genuine interest in the role and a one-sentence hook tying the candidate's background to what the JD asks for.`,
        `- Paragraph 2: highlight 2-3 specific experiences/skills from the resume that directly map to the JD's priorities. Be concrete, reference real accomplishments — do not invent.`,
        `- Paragraph 3: close with what excites the candidate about the company/role, signal enthusiasm to discuss further, and thank the reader.`,
        `- Do NOT include a salutation ("Dear...") or a signature ("Sincerely, Name") — those are added by the renderer.`,
        `- Do NOT include the candidate's address, phone, or contact lines — those are in the document header.`,
        `- Write in plain paragraphs separated by blank lines. No headers, lists, or markdown.`,
        candidateName ? `- The candidate's name is "${candidateName}" — use it sparingly (e.g. in the hook), do not repeat it many times.` : '',
        `- Write in the same language as the rest of the output (English if language="en", Spanish if language="es").`,
    ].filter(Boolean).join('\n');
}

// `baseResume` shape (from composeResume + skills query):
//   experience: [{ pool_id, company, role, start_date, end_date, description }]
//   skills:     [{ id, name, category }]
//   summary:    { content } | null
async function tailor({ baseResume, jobDescription, companyName, language, notes, includeCoverLetter, candidateName }) {
    const client = getClient();

    const canonicalBlock = buildCanonicalBlock(baseResume, language);
    const jobBlock = buildJobBlock(jobDescription, companyName || '');
    const coverBlock = buildCoverLetterBlock(!!includeCoverLetter, candidateName || '');
    const notesBlock = notes && notes.trim()
        ? `Additional notes from the user (override prior choices accordingly):\n${notes.trim()}`
        : 'No additional notes — generate the best tailored version you can.';

    // Cache breakpoints (stable → volatile, by prefix-match cache semantics):
    //   1. system prompt          — stable across all calls
    //   2. canonical resume       — stable per user (reused across many JDs)
    //   3. job description block  — stable per session (reused across regenerate-with-notes)
    // Notes vary per call and sit after the last breakpoint.
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: {
            effort: 'medium',
            format: { type: 'json_schema', schema: TAILOR_SCHEMA },
        },
        system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: canonicalBlock, cache_control: { type: 'ephemeral' } },
                    { type: 'text', text: jobBlock, cache_control: { type: 'ephemeral' } },
                    { type: 'text', text: coverBlock },
                    { type: 'text', text: notesBlock },
                ],
            },
        ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('LLM returned no text block.');

    let parsed;
    try {
        parsed = JSON.parse(textBlock.text);
    } catch (err) {
        throw new Error(`LLM response was not valid JSON: ${err.message}`);
    }

    return {
        ...parsed,
        _meta: {
            provider: PROVIDER_NAME,
            model: response.model,
            usage: response.usage,
        },
    };
}

module.exports = { tailor, providerName: PROVIDER_NAME, model: MODEL };
