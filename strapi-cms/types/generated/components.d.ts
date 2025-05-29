import type { Schema, Struct } from '@strapi/strapi';

export interface LinksLinks extends Struct.ComponentSchema {
  collectionName: 'components_links_links';
  info: {
    displayName: 'Links';
  };
  attributes: {
    posts: Schema.Attribute.Relation<'oneToMany', 'api::post.post'>;
  };
}

export interface SharedBookFlip extends Struct.ComponentSchema {
  collectionName: 'components_shared_book_flips';
  info: {
    displayName: 'Book Flip';
    icon: 'book';
  };
  attributes: {
    pdf_file: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    title: Schema.Attribute.String;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    description: '';
    displayName: 'Media';
    icon: 'file-image';
  };
  attributes: {
    caption: Schema.Attribute.String;
    file: Schema.Attribute.Media<'images' | 'videos' | 'files'> & Schema.Attribute.Required;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich Text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.JSON & Schema.Attribute.CustomField<'plugin::lexical.lexical'>;
  };
}

export interface SharedScrollingGallery extends Struct.ComponentSchema {
  collectionName: 'components_shared_scrolling_galleries';
  info: {
    description: 'A scrolling gallery with images and videos';
    displayName: 'Scrolling Gallery';
    icon: 'slideshow';
  };
  attributes: {
    gallery_content: Schema.Attribute.Media<'images' | 'videos', true> & Schema.Attribute.Required;
    gallery_height: Schema.Attribute.String & Schema.Attribute.DefaultTo<'300px'>;
  };
}

export interface SharedVideoEmbed extends Struct.ComponentSchema {
  collectionName: 'components_shared_video_embeds';
  info: {
    description: '';
    displayName: 'Video Embed';
    icon: 'video';
  };
  attributes: {
    caption: Schema.Attribute.String;
    provider: Schema.Attribute.Enumeration<['youtube', 'vimeo']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'youtube'>;
    provider_uid: Schema.Attribute.String & Schema.Attribute.Required;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'links.links': LinksLinks;
      'shared.book-flip': SharedBookFlip;
      'shared.media': SharedMedia;
      'shared.rich-text': SharedRichText;
      'shared.scrolling-gallery': SharedScrollingGallery;
      'shared.video-embed': SharedVideoEmbed;
    }
  }
}
