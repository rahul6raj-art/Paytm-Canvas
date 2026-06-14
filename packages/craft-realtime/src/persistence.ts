import * as Y from "yjs";
import { prisma } from "@paytm-craft/api/db";
import { base64ToUint8, uint8ToBase64 } from "./room.js";
import {
  bootstrapYDocFromDocumentJson,
  readDocumentJsonFromYDoc,
} from "./yjsDocument.js";

/** Hocuspocus-style hydrate: Postgres Yjs snapshot, else file.documentJson bootstrap. */
export async function onLoadDocument(fileId: string): Promise<Y.Doc> {
  const yjsRow = await prisma.fileYjsState.findUnique({ where: { fileId } });
  const doc = new Y.Doc();
  if (yjsRow?.stateBase64) {
    Y.applyUpdate(doc, base64ToUint8(yjsRow.stateBase64));
    return doc;
  }

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) {
    return doc;
  }
  return bootstrapYDocFromDocumentJson(file.documentJson);
}

/** Hocuspocus-style persist: store Yjs update + mirror documentJson on the file row. */
export async function onStoreDocument(fileId: string, doc: Y.Doc): Promise<void> {
  const stateBase64 = uint8ToBase64(Y.encodeStateAsUpdate(doc));
  const documentJson = readDocumentJsonFromYDoc(doc);

  await prisma.$transaction([
    prisma.fileYjsState.upsert({
      where: { fileId },
      create: { fileId, stateBase64 },
      update: { stateBase64 },
    }),
    ...(documentJson != null
      ? [
          prisma.file.update({
            where: { id: fileId },
            data: { documentJson: documentJson as object },
          }),
        ]
      : []),
  ]);
}
