-- CreateTable
CREATE TABLE "file_yjs_states" (
    "file_id" TEXT NOT NULL,
    "state_base64" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_yjs_states_pkey" PRIMARY KEY ("file_id")
);

-- AddForeignKey
ALTER TABLE "file_yjs_states" ADD CONSTRAINT "file_yjs_states_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
