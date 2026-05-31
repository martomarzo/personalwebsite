const anthropic = require('./anthropic');

function getProvider() {
    const name = process.env.LLM_PROVIDER || 'anthropic';
    if (name === 'anthropic') return anthropic;
    throw new Error(`Unknown LLM provider "${name}". Set LLM_PROVIDER env var.`);
}

module.exports = { getProvider };
