// tests only: files are written to public/uploads instead of Cloudflare R2
module.exports = () => ({
  upload: { config: { provider: "local", providerOptions: {} } },
});
