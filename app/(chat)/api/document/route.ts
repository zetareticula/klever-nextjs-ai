import { auth } from '@/app/(auth)/auth';
import { ArtifactKind } from '@/components/artifact';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/queries';

/// This route handles the document API requests
/// It uses the `auth` function to authenticate the user
/// It uses the `getDocumentsById` function to get the documents by id
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  // Check if the session is valid
  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const documents = await getDocumentsById({ id }); // Get documents by id

  const [document] = documents; // Get the first document from the array

  // Check if the document exists
  if (!document) {
    return new Response('Not Found', { status: 404 });
  }
  // Check if the user is authorized to access the document
  if (document.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Check if the document is empty
  return Response.json(documents, { status: 200 });
}
/// This route handles the document a POST request which is used to create a new document
/// It uses the `auth` function to authenticate the user
/// It uses the `saveDocument` function to save the document in the database
/// It uses the `getDocumentsById` function to get the documents by id
/// It uses the `deleteDocumentsByIdAfterTimestamp` function to delete the documents by id and timestamp
/// It uses the `saveDocument` function to save the document in the database
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  if (session.user?.id) {
    const document = await saveDocument({
      id,
      content,
      title,
      kind,
      userId: session.user.id,
    });

    return Response.json(document, { status: 200 });
  }

  return new Response('Unauthorized', { status: 401 });
}

/// This route handles the document a PATCH request which is used to update a document
/// It uses the `auth` function to authenticate the user
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const { timestamp }: { timestamp: string } = await request.json();

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (document.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return new Response('Deleted', { status: 200 });
}
