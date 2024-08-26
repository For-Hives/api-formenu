import type { Schema, Attribute } from '@strapi/strapi';

export interface ContentWebsiteContentWebsite extends Schema.Component {
  collectionName: 'components_content_website_content_websites';
  info: {
    displayName: 'Content_website';
    icon: 'archive';
  };
  attributes: {
    metadata_title: Attribute.String;
    metadata_description: Attribute.String;
    home_title: Attribute.String;
    home_subtitle: Attribute.String;
    home_background_images: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    home_image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'content-website.content-website': ContentWebsiteContentWebsite;
    }
  }
}
