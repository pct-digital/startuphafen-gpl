DO $$
BEGIN
  BEGIN
    PERFORM control_extension('create', 'vector');
  EXCEPTION
    WHEN OTHERS THEN
      BEGIN
        EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
  END;
END
$$;

-- CreateTable
CREATE TABLE "VectorEmbedding" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VectorEmbedding_pkey" PRIMARY KEY ("id")
);
