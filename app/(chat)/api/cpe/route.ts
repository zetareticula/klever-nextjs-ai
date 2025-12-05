import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getCPE } from '@/lib/ai/cpe';

/**
 * GET endpoint for retrieving proactive suggestions and context-aware actions
 * This enables the UI to display personalized suggestions based on user context
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const cpe = getCPE();

    // Get proactive suggestions for the user
    const suggestions = cpe.getProactiveSuggestions(session.user.id);

    // Get suggested actions based on context
    const suggestedActions = cpe.getSuggestedActions(session.user.id);

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 5).map((s) => ({
        id: s.id,
        message: s.message,
        reason: s.reason,
        type: s.type,
        priority: s.priority,
        confidence: s.confidence,
      })),
      suggestedActions: suggestedActions.slice(0, 4),
    });
  } catch (error) {
    console.error('CPE suggestions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for adding context to the CPE knowledge base
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { content, category, metadata } = body;

    if (!content || !category) {
      return NextResponse.json(
        { success: false, error: 'Content and category are required' },
        { status: 400 }
      );
    }

    const validCategories = [
      'user_preference',
      'interaction_history',
      'knowledge',
      'temporal',
      'goal',
    ];

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    const cpe = getCPE();
    const entry = cpe.addContext(content, category, {
      ...metadata,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        content: entry.content,
        category: entry.category,
        createdAt: entry.createdAt,
      },
    });
  } catch (error) {
    console.error('CPE add context error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add context' },
      { status: 500 }
    );
  }
}
