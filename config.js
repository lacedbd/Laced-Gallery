// config.js
// PUBLIC configuration for your GitHub database and Web3Forms.
export const CONFIG = {
    githubUsername: 'lacedbd',
    githubRepo: 'Laced-Gallery',
    web3formsKey: 'YOUR_WEB3FORMS_ACCESS_KEY' // We will get this next!
};

// Helper function to get the raw URL of your JSON database files
export const getRawDataUrl = (file) => {
    // We add a timestamp query parameter to bypass GitHub's raw caching
    return `https://raw.githubusercontent.com/${CONFIG.githubUsername}/${CONFIG.githubRepo}/main/data/${file}?t=${new Date().getTime()}`;
};
