// config.js
// PUBLIC configuration for your GitHub database and Web3Forms.
export const CONFIG = {
    githubUsername: 'lacedbd',
    githubRepo: 'Laced-Gallery',
    web3formsKey: '5ecffbfe-1582-4817-8cd5-30afe0142379'
};

// Helper function to get the raw URL of your JSON database files
export const getRawDataUrl = (file) => {
    // We add a timestamp query parameter to bypass GitHub's raw caching
    return `https://raw.githubusercontent.com/${CONFIG.githubUsername}/${CONFIG.githubRepo}/main/data/${file}?t=${new Date().getTime()}`;
};
