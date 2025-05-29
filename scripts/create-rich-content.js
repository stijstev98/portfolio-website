const fetch = require('node-fetch');

async function createComponents() {
  console.log('Creating rich content components in Strapi...');
  
  const components = [
    {
      category: 'shared',
      displayName: 'Rich Text',
      attributes: {
        body: {
          type: 'richtext',
          required: true
        }
      }
    },
    {
      category: 'shared',
      displayName: 'Media',
      attributes: {
        file: {
          type: 'media',
          allowedTypes: ['images', 'videos', 'files'],
          multiple: false,
          required: true
        },
        caption: {
          type: 'string'
        }
      }
    },
    {
      category: 'shared',
      displayName: 'Video Embed',
      attributes: {
        provider_uid: {
          type: 'string',
          required: true
        },
        provider: {
          type: 'enumeration',
          enum: ['youtube', 'vimeo'],
          default: 'youtube',
          required: true
        },
        title: {
          type: 'string'
        },
        caption: {
          type: 'string'
        }
      }
    },
    {
      category: 'shared',
      displayName: 'Scrolling Gallery',
      attributes: {
        gallery_content: {
          type: 'media',
          multiple: true,
          required: true,
          allowedTypes: ['images', 'videos']
        },
        gallery_height: {
          type: 'string',
          default: '300px'
        }
      }
    },
    {
      category: 'shared',
      displayName: 'Callout',
      attributes: {
        type: {
          type: 'enumeration',
          enum: ['info', 'warning', 'danger', 'success'],
          default: 'info',
          required: true
        },
        title: {
          type: 'string'
        },
        content: {
          type: 'richtext',
          required: true
        }
      }
    },
    {
      category: 'shared',
      displayName: 'Custom Component',
      attributes: {
        title: {
          type: 'string',
          required: true
        },
        content: {
          type: 'richtext'
        },
        style: {
          type: 'enumeration',
          enum: ['default', 'highlighted', 'important', 'subdued'],
          default: 'default'
        }
      }
    }
  ];
  
  try {
    // Create each component
    for (const component of components) {
      console.log(`Creating component: ${component.displayName}`);
      
      try {
        const response = await fetch('http://127.0.0.1:1337/content-type-builder/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ component })
        });
        
        if (!response.ok) {
          const error = await response.text();
          if (error.includes('already exists')) {
            console.log(`Component ${component.displayName} already exists.`);
          } else {
            console.error(`Error creating component ${component.displayName}:`, error);
          }
        } else {
          console.log(`Successfully created component: ${component.displayName}`);
        }
      } catch (error) {
        console.error(`Error creating component ${component.displayName}:`, error.message);
      }
    }
    
    // Update Post content type to add dynamic zone
    console.log('Adding dynamic zone to Post content type...');
    
    const componentUids = components.map(comp => 
      `shared.${comp.displayName.toLowerCase().replace(/\s+/g, '-')}`
    );
    
    const postUpdateResponse = await fetch('http://127.0.0.1:1337/content-type-builder/content-types/api::post.post', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: {
          displayName: 'Post',
          singularName: 'post',
          pluralName: 'posts',
          attributes: {
            content_components: {
              type: 'dynamiczone',
              components: componentUids
            }
          }
        }
      })
    });
    
    if (!postUpdateResponse.ok) {
      console.error('Error updating Post content type:', await postUpdateResponse.text());
    } else {
      console.log('Successfully updated Post content type with dynamic zone');
    }
  } catch (error) {
    console.error('Error in component creation process:', error);
  }
}

createComponents();
