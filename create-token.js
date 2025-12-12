const Strapi = require('@strapi/strapi');

async function createToken() {
  const strapi = await Strapi().load();

  try {
    const apiTokenService = strapi.service('admin::api-token');

    // Check if token already exists to avoid duplicates
    const existing = await apiTokenService.exists({ name: 'LocalDevToken' });
    if (existing) {
      console.log('Token already exists, retrieving it...');
      // Note: We can't retrieve the access key after creation easily as it's hashed,
      // so we might need to recreate it if we lost it.
      // For this script, let's delete and recreate to be sure we have the key.
      const tokens = await apiTokenService.list();
      const token = tokens.find(t => t.name === 'LocalDevToken');
      if (token) {
        await apiTokenService.revoke(token.id);
        await apiTokenService.delete(token.id);
      }
    }

    const token = await apiTokenService.create({
      name: 'LocalDevToken',
      type: 'full-access',
      description: 'Token generated for local development verification',
      lifespan: null, // Unlimited
    });

    console.log('__TOKEN_START__');
    console.log(token.accessKey);
    console.log('__TOKEN_END__');

  } catch (error) {
    console.error('Error creating token:', error);
  } finally {
    process.exit(0); // Exit cleanly
  }
}

createToken();
