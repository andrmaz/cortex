# Process document ingestion asynchronously

The API persists an uploaded Document and enqueues a BullMQ job in Redis; a worker later chunks the content, generates embeddings, and updates ingestion state. This keeps upload handling separate from slow, failure-prone provider work and enables retries, at the cost of operating Redis and a worker alongside the API.
