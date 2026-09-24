-- El creador puede responder los comentarios del cliente desde la pieza. La
-- marca distingue esas respuestas de lo que pide el cliente, en los dos lados.
ALTER TABLE "Comment" ADD COLUMN "byOwner" BOOLEAN NOT NULL DEFAULT false;
