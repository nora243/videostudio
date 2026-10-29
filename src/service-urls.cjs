const urls = {
  gemini: 'https://gemini.google.com/app',
  flow: 'https://labs.google/fx/tools/flow'
};

function isServiceUrl(service, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    if (service === 'gemini') return url.hostname === 'gemini.google.com';
    if (service === 'flow') {
      return url.hostname === 'flow.google.com' ||
        (url.hostname === 'labs.google' && /^\/fx\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?tools\/flow(?:\/|$)/i.test(url.pathname));
    }
    return false;
  } catch { return false; }
}

module.exports = { urls, isServiceUrl };
