module.exports = ({env}) => ({
  // ...
  'import-export-entries': {
    enabled: true,
    config: {
      // See `Config` section.
    },
  },
  upload: {
    config: {
      provider: "minio-for-strapi-v4",
      providerOptions: {
        endPoint: env("S3_ENDPOINT"), //s3.example.com
        port: 443, // parseInt(env("S3_PORT"), 9000), //9000
        useSSL: env("S3_SSL", false) === "true", //true or false
        accessKey: env("S3_ACCESS_KEY_ID"),
        secretKey: env("S3_ACCESS_SECRET"),
        bucket: env("S3_BUCKET"),
      },
    },
  },
  translate: {
    enabled: true,
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
