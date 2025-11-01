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
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    title: Schema.Attribute.String;
  };
}

export interface SharedMasonryGallery extends Struct.ComponentSchema {
  collectionName: 'components_shared_masonry_galleries';
  info: {
    displayName: 'Masonry Gallery';
    icon: 'apps';
  };
  attributes: {
    masonry_images: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    size: Schema.Attribute.Enumeration<['small', 'medium', 'large']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'large'>;
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
    file: Schema.Attribute.Media<'images' | 'videos' | 'files'> &
      Schema.Attribute.Required;
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface SharedPhotoGroup extends Struct.ComponentSchema {
  collectionName: 'components_shared_photo_groups';
  info: {
    description: '';
    displayName: 'Photo group';
    icon: 'landscape';
  };
  attributes: {
    group_description: Schema.Attribute.Text;
    group_title: Schema.Attribute.String;
    photos: Schema.Attribute.Component<'shared.single-photo', true>;
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
    body: Schema.Attribute.Blocks;
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
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
    gallery_content: Schema.Attribute.Media<'images' | 'videos', true> &
      Schema.Attribute.Required;
    gallery_height: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'300px'>;
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface SharedSimpleMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_simple_media';
  info: {
    description: 'Up to 3 pieces of media rendered side by side with captions and lightbox support';
    displayName: 'Simple Media';
    icon: 'image';
  };
  attributes: {
    media_files: Schema.Attribute.Media<'images' | 'videos', true> &
      Schema.Attribute.Required;
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    show_caption: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    show_infobox: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    size: Schema.Attribute.Enumeration<['small', 'medium', 'large']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'medium'>;
  };
}

export interface SharedSinglePhoto extends Struct.ComponentSchema {
  collectionName: 'components_shared_single_photos';
  info: {
    displayName: 'Single photo';
    icon: 'image';
  };
  attributes: {
    camera: Schema.Attribute.Enumeration<
      [
        'Canon A1',
        'Canon AE-1',
        'Nikon F3',
        'Nikon FM2',
        'Pentax K1000',
        'Minolta X-700',
        'Olympus OM-1',
        'Leica M6',
        'Hasselblad 500C',
        'Mamiya RB67',
        'Other',
      ]
    >;
    country: Schema.Attribute.String;
    filmstock: Schema.Attribute.String;
    photo: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    place: Schema.Attribute.String;
    year: Schema.Attribute.String;
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
    responsive_display: Schema.Attribute.Enumeration<
      ['default', 'desktop-only', 'mobile-only']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'links.links': LinksLinks;
      'shared.book-flip': SharedBookFlip;
      'shared.masonry-gallery': SharedMasonryGallery;
      'shared.media': SharedMedia;
      'shared.photo-group': SharedPhotoGroup;
      'shared.rich-text': SharedRichText;
      'shared.scrolling-gallery': SharedScrollingGallery;
      'shared.simple-media': SharedSimpleMedia;
      'shared.single-photo': SharedSinglePhoto;
      'shared.video-embed': SharedVideoEmbed;
    }
  }
}
