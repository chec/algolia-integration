import { IntegrationHandler } from '@chec/integration-handler';
import algoliasearch from 'algoliasearch';

const handler: IntegrationHandler = async (request, context) => {
  // Fetch integration configuration
  const integration = await context.integration();
  const { config } = integration;

  if (!config.application_id || !config.admin_api_key) {
    return {
      statusCode: 503,
      body: 'Either the application ID or admin API key is undefined, please check your configuration.',
    };
  }

  // Establish index names, falling back to defaults
  const {
    products_index = 'products',
    categories_index = 'categories',
  } = config;

  // Initialize Algolia client
  const client = algoliasearch(config.application_id, config.admin_api_key);

  // Extract payload from webhook
  const { payload } = request.body;

  // Integrations are run by events, usually from a webhook. The event that triggered this action is available within
  // the body of the request
  let result;
  switch (request.body.event) {
    case 'integrations.ready':
      // Fetch all products and categories and sync them all
      let productsAdded = 0;
      let categoriesAdded = 0;

      // Product sync
      let page = 1;
      let promises = [];
      do {
        // @ts-ignore
        const { data, meta } = await context.api.get(`v1/products?limit=200&page=${page}`);
        if (!data || !data.length) {
          console.error('Unable to fetch products, there might not be any');
          break;
        }
        // Sync all products
        data.map((product) => {
          promises.push(
            saveProduct(client, products_index, product)
              .then(() => {
                productsAdded++;
              })
          );
        });
        // Await each page at a time, hopefully avoiding rate limiting errors from Algolia
        await Promise.all(promises);
        // Fetch next page?
        if (!meta?.pagination?.total_pages || page === meta.pagination.total_pages) {
          // We've reached the last page, kill the loop
          page = 0;
        } else {
          // Fetch next page
          page++;
        }
      } while (page >= 1);

      // Category sync
      page = 1;
      promises = [];
      do {
        // @ts-ignore
        const { data, meta } = await context.api.get(`v1/categories?limit=200&page=${page}`);
        if (!data || !data.length) {
          console.error('Unable to fetch categories, there might not be any');
          break;
        }
        // Sync all products
        data.map((category) => {
          promises.push(
            saveCategory(client, categories_index, category)
              .then(() => {
                categoriesAdded++;
              })
          );
        });
        // Await each page at a time, hopefully avoiding rate limiting errors from Algolia
        await Promise.all(promises);
        // Fetch next page?
        if (!meta?.pagination?.total_pages || page === meta.pagination.total_pages) {
          // We've reached the last page, kill the loop
          page = 0;
        } else {
          // Fetch next page
          page++;
        }
      } while (page >= 1);

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: 'Sync completed!',
          products: productsAdded,
          categories: categoriesAdded,
        }),
      };

    case 'products.create':
    case 'products.update':
      // Create/update product in index
      result = await saveProduct(client, products_index, request.body.payload);
      return {
        statusCode: request.body.event === 'products.create' ? 201 : 200,
        body: JSON.stringify({
          objectID: result.objectID,
          taskID: result.taskID,
        }),
      };

    case 'products.delete':
      // Delete product from index
      // @ts-ignore-next-line
      await client.initIndex(products_index).deleteObject(request.body.model_ids[0]);
      return {
        statusCode: 204,
        body: '',
      };

    case 'categories.create':
    case 'categories.update':
      // Create/update category in index
      result = await saveCategory(client, categories_index, request.body.payload);
      return {
        statusCode: request.body.event === 'categories.create' ? 201 : 200,
        body: JSON.stringify({
          objectID: result.objectID,
          taskID: result.taskID,
        }),
      };

    case 'categories.delete':
      // Delete category from index
      // @ts-ignore-next-line
      await client.initIndex(categories_index).deleteObject(request.body.model_ids[0]);
      return {
        statusCode: 204,
        body: '',
      };
  }

  return {
    statusCode: 200,
    body: 'Nothing happened, might be an unwanted webhook event...',
  };
};

/**
 * Saves something to Algolia with the client
 *
 * @param {algoliasearch} client
 * @param {string} indexName
 * @param {object} payload
 */
function saveObject(client, indexName, payload) {
  return client.initIndex(indexName).saveObject(payload);
}

/**
 * Saves a product to Algolia with the client
 *
 * @param {algoliasearch} client
 * @param {string} indexName
 * @param {object} product
 */
function saveProduct(client, indexName, product) {
  const payload = {
    objectID: product.id, // Only field required by Algolia
    id: product.id,
    name: product.name,
    description: product.description,
    permalink: product.permalink,
    sku: product.sku,
    inventory: product.inventory,
    price: product.price,
    assets: product.assets,
    image: product.image,
    seo: product.seo,
    sort_order: product.sort_order,
    extra_fields: product.extra_fields,
    attributes: product.attributes,
    categories: product.categories,
    related_products: product.related_products,
    meta: product.meta,
    active: product.active,
    created: product.created,
    updated: product.updated,
  };

  return saveObject(client, indexName, payload);
}

/**
 * Saves a category to Algolia with the client
 *
 * @param {algoliasearch} client
 * @param {string} indexName
 * @param {object} category
 */
function saveCategory(client, indexName, category) {
  const payload = {
    objectID: category.id, // Only field required by Algolia
    id: category.id,
    name: category.name,
    slug: category.slug,
    parent_id: category.parent_id,
    description: category.description,
    products: category.products,
    assets: category.assets,
    children: category.children,
    meta: category.meta,
    created: category.created,
    updated: category.updated,
  };

  return saveObject(client, indexName, payload);
}

export = handler;
