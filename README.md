# Commerce.js Algolia integration

This repo contains an integration for Algolia, which will automatically update an index when products or categories
change in the Chec API.

## Configuration

This integration requires the following configuration fields:

* Algolia Admin API key, available from your Algolia account's Settings > API keys page
* The Algolia application ID
* The index name to update for products, and categories (default: `products` and `categories`)

## Setup

* Create an Algolia account
* Create an empty index
* Copy your admin API key
* Create the integration in the Chec Dashboard and enter your configuration settings

When this integration runs, it will initially handle the `integrations.ready` event, and use it to sync all products
and categories into your Algolia search indexes. On subsequent runs it will fire on `products.create`,
`categories.update`, etc., and will update or create records in the index as necessary.

## License

See [license](LICENSE.md).
