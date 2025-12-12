module.exports = ({env}) => ({
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("CF_ACCESS_KEY_ID"),
        secretAccessKey: env("CF_ACCESS_SECRET"),
        /**
         * `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
         */
        endpoint: env("CF_ENDPOINT"),
        params: {
          Bucket: env("CF_BUCKET"),
        },
        /**
         * Set this Option to store the CDN URL of your files and not the R2 endpoint URL in your DB.
         * Can be used in Cloudflare R2 with Domain-Access or Public URL: https://pub-<YOUR_PULIC_BUCKET_ID>.r2.dev
         * This option is required to upload files larger than 5MB, and is highly recommended to be set.
         * Check the cloudflare docs for the setup: https://developers.cloudflare.com/r2/data-access/public-buckets/#enable-public-access-for-your-bucket
         */
        cloudflarePublicAccessUrl: env("CF_PUBLIC_ACCESS_URL"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    }
  },
  translate: {
    enabled: !!env("DEEPL_API_KEY"),
    config: {
      // Choose one of the available providers
      provider: 'deepl',
      // Pass credentials and other options to the provider
      providerOptions: {
        // use custom locale mapping (for example 'en' locale is deprecated so need to choose between 'EN-GB' and 'EN-US')
        localeMap: {
          // use uppercase here!
          FR: 'FR',
          EN: 'EN-US',
        },
        apiOptions: {
          // see <https://github.com/DeepLcom/deepl-node#text-translation-options> for supported options.
          // note that tagHandling Mode cannot be set this way.
          // use with caution, as non-default values may break translation of markdown
          formality: 'default',
          // ...
        }
      },
    }
  }
});
