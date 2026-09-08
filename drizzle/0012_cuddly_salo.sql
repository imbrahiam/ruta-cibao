ALTER TABLE "places" ADD COLUMN "embedding" vector(384);--> statement-breakpoint
CREATE INDEX "places_embedding_idx" ON "places" USING hnsw ("embedding" vector_cosine_ops);