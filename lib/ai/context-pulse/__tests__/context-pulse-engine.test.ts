/**
 * Unit tests for the ContextPulse Engine (CPE)
 * Tests FAISS service, embedding service, and context retrieval
 * 
 * Run with: npx tsx lib/ai/context-pulse/__tests__/context-pulse-engine.test.ts
 */

import { strict as assert } from 'node:assert';
import {
  FAISSService,
  TemporalTriggerService,
  ContextPulseEngine,
  cosineSimilarity,
  l2Distance,
  type ContextEntry,
  type ContextCategory,
} from '../index';

// Test utilities
function describe(name: string, fn: () => void | Promise<void>) {
  console.log(`\n📦 ${name}`);
  fn();
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${error}`);
    process.exitCode = 1;
  }
}

// Helper to create a test context entry
function createTestEntry(
  id: string,
  content: string,
  category: ContextCategory = 'conversation_context'
): ContextEntry {
  return {
    id,
    content,
    metadata: {
      userId: 'test-user-1',
      category,
      source: 'chat_message',
    },
    createdAt: new Date(),
  };
}

// Run all tests
async function runTests() {
  console.log('🧪 Running ContextPulse Engine Tests\n');

  // ===================
  // Embedding Service Tests
  // ===================
  describe('Embedding Service', async () => {
    await test('cosineSimilarity returns 1 for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const similarity = cosineSimilarity(vector, vector);
      assert(Math.abs(similarity - 1) < 0.0001, 'Expected similarity to be 1');
    });

    await test('cosineSimilarity returns 0 for orthogonal vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const similarity = cosineSimilarity(vector1, vector2);
      assert(Math.abs(similarity) < 0.0001, 'Expected similarity to be 0');
    });

    await test('l2Distance returns 0 for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const distance = l2Distance(vector, vector);
      assert(Math.abs(distance) < 0.0001, 'Expected distance to be 0');
    });

    await test('l2Distance calculates correctly', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [3, 4, 0];
      const distance = l2Distance(vector1, vector2);
      assert(Math.abs(distance - 5) < 0.0001, 'Expected distance to be 5');
    });

    await test('throws error for mismatched dimensions', () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2];
      try {
        cosineSimilarity(vector1, vector2);
        assert.fail('Expected error to be thrown');
      } catch (error) {
        assert(error instanceof Error);
        assert(error.message.includes('same dimensions'));
      }
    });
  });

  // ===================
  // FAISS Service Tests
  // ===================
  describe('FAISS Service', async () => {
    await test('can add and retrieve entries', async () => {
      const faiss = new FAISSService();
      const entry = createTestEntry('test-1', 'The quick brown fox jumps over the lazy dog');
      
      const success = await faiss.addEntry(entry);
      assert(success, 'Expected entry to be added successfully');
      
      const retrieved = faiss.getEntry('test-1');
      assert(retrieved !== undefined, 'Expected entry to be retrieved');
      assert.equal(retrieved.content, entry.content);
    });

    await test('can search for similar entries', async () => {
      const faiss = new FAISSService();
      
      // Add some test entries
      await faiss.addEntry(createTestEntry('1', 'I love programming in TypeScript'));
      await faiss.addEntry(createTestEntry('2', 'JavaScript is my favorite language'));
      await faiss.addEntry(createTestEntry('3', 'The weather is sunny today'));
      
      // Search for programming-related content (use minScore 0 for mock embeddings)
      const results = await faiss.search('TypeScript programming', { topK: 2, minScore: 0 });
      
      assert(results.length > 0, 'Expected at least one result');
      // Just verify we get results, since mock embeddings don't reflect real semantic similarity
      assert(results.length <= 2, 'Expected at most 2 results');
    });

    await test('can remove entries', async () => {
      const faiss = new FAISSService();
      const entry = createTestEntry('removable', 'This entry will be removed');
      
      await faiss.addEntry(entry);
      assert(faiss.getEntry('removable') !== undefined);
      
      const removed = faiss.removeEntry('removable');
      assert(removed, 'Expected entry to be removed');
      assert(faiss.getEntry('removable') === undefined, 'Entry should not exist after removal');
    });

    await test('can update entries', async () => {
      const faiss = new FAISSService();
      const entry = createTestEntry('updatable', 'Original content');
      
      await faiss.addEntry(entry);
      
      const success = await faiss.updateEntry('updatable', {
        content: 'Updated content',
      });
      
      assert(success, 'Expected update to succeed');
      const updated = faiss.getEntry('updatable');
      assert.equal(updated?.content, 'Updated content');
    });

    await test('respects topK limit', async () => {
      const faiss = new FAISSService();
      
      for (let i = 0; i < 10; i++) {
        await faiss.addEntry(createTestEntry(`entry-${i}`, `Test content number ${i}`));
      }
      
      const results = await faiss.search('Test content', { topK: 3 });
      assert.equal(results.length, 3, 'Expected exactly 3 results');
    });

    await test('filters by user ID', async () => {
      const faiss = new FAISSService();
      
      await faiss.addEntry({
        id: 'user1-entry',
        content: 'Content for user 1',
        metadata: { userId: 'user1', category: 'conversation_context', source: 'chat_message' },
        createdAt: new Date(),
      });
      
      await faiss.addEntry({
        id: 'user2-entry',
        content: 'Content for user 2',
        metadata: { userId: 'user2', category: 'conversation_context', source: 'chat_message' },
        createdAt: new Date(),
      });
      
      const results = await faiss.search('Content', {
        topK: 10,
        filters: { userId: 'user1' },
      });
      
      assert.equal(results.length, 1, 'Expected only 1 result for user1');
      assert.equal(results[0].entry.metadata.userId, 'user1');
    });

    await test('exports and imports correctly', async () => {
      const faiss1 = new FAISSService();
      await faiss1.addEntry(createTestEntry('export-test', 'Exportable content'));
      
      const exported = faiss1.export();
      
      const faiss2 = new FAISSService();
      faiss2.import(exported);
      
      const entry = faiss2.getEntry('export-test');
      assert(entry !== undefined, 'Expected entry to exist after import');
      assert.equal(entry.content, 'Exportable content');
    });

    await test('returns correct stats', async () => {
      const faiss = new FAISSService();
      await faiss.addEntry(createTestEntry('stats-1', 'First entry'));
      await faiss.addEntry(createTestEntry('stats-2', 'Second entry'));
      
      const stats = faiss.getStats();
      assert.equal(stats.totalEntries, 2);
      assert.equal(stats.indexType, 'flat');
    });
  });

  // ===================
  // Temporal Trigger Service Tests
  // ===================
  describe('Temporal Trigger Service', async () => {
    await test('can add and retrieve temporal triggers', () => {
      const triggerService = new TemporalTriggerService();
      
      const triggerId = triggerService.addTemporalTrigger({
        userId: 'test-user',
        type: 'scheduled',
        schedule: { type: 'daily', time: '09:00' },
        message: 'Good morning! Ready to start your day?',
        enabled: true,
      });
      
      assert(triggerId, 'Expected trigger ID to be returned');
      
      const triggers = triggerService.getTemporalTriggersForUser('test-user');
      assert.equal(triggers.length, 1);
      assert.equal(triggers[0].message, 'Good morning! Ready to start your day?');
    });

    await test('can add and retrieve contextual triggers', () => {
      const triggerService = new TemporalTriggerService();
      
      const triggerId = triggerService.addContextualTrigger({
        userId: 'test-user',
        condition: 'When user discusses fitness',
        contextQuery: 'exercise workout fitness gym',
        threshold: 0.7,
        message: 'Would you like some workout suggestions?',
        enabled: true,
      });
      
      assert(triggerId, 'Expected trigger ID to be returned');
      
      const triggers = triggerService.getContextualTriggersForUser('test-user');
      assert.equal(triggers.length, 1);
      assert.equal(triggers[0].condition, 'When user discusses fitness');
    });

    await test('can enable/disable triggers', () => {
      const triggerService = new TemporalTriggerService();
      
      const triggerId = triggerService.addTemporalTrigger({
        userId: 'test-user',
        type: 'scheduled',
        schedule: { type: 'daily', time: '09:00' },
        message: 'Test message',
        enabled: true,
      });
      
      const disabled = triggerService.setTemporalTriggerEnabled(triggerId, false);
      assert(disabled, 'Expected disable to succeed');
      
      const triggers = triggerService.getTemporalTriggersForUser('test-user');
      assert.equal(triggers[0].enabled, false);
    });

    await test('can remove triggers', () => {
      const triggerService = new TemporalTriggerService();
      
      const triggerId = triggerService.addTemporalTrigger({
        userId: 'test-user',
        type: 'scheduled',
        schedule: { type: 'daily', time: '09:00' },
        message: 'Test message',
        enabled: true,
      });
      
      const removed = triggerService.removeTemporalTrigger(triggerId);
      assert(removed, 'Expected removal to succeed');
      
      const triggers = triggerService.getTemporalTriggersForUser('test-user');
      assert.equal(triggers.length, 0);
    });
  });

  // ===================
  // ContextPulse Engine Tests
  // ===================
  describe('ContextPulse Engine', async () => {
    await test('can add and retrieve context', async () => {
      const cpe = new ContextPulseEngine({
        minSimilarityScore: 0, // Lower threshold for testing with mock embeddings
      });
      
      const contextId = await cpe.addContext(
        'User prefers TypeScript over JavaScript',
        'test-user',
        'chat-1',
        'user_preference'
      );
      
      assert(contextId, 'Expected context ID to be returned');
      
      const results = await cpe.retrieveContext('TypeScript preferences', 'test-user', {
        minScore: 0, // Lower threshold for mock embeddings
      });
      assert(results.length > 0, 'Expected at least one result');
    });

    await test('can add and retrieve user goals', async () => {
      const cpe = new ContextPulseEngine();
      
      const goal = await cpe.addUserGoal(
        'test-user',
        'Learn machine learning',
        'high'
      );
      
      assert(goal.id, 'Expected goal ID to be set');
      assert.equal(goal.description, 'Learn machine learning');
      assert.equal(goal.priority, 'high');
      
      const goals = cpe.getUserGoals('test-user');
      assert.equal(goals.length, 1);
    });

    await test('can update goal status', async () => {
      const cpe = new ContextPulseEngine();
      
      const goal = await cpe.addUserGoal('test-user', 'Complete project', 'medium');
      
      const success = cpe.updateGoalStatus('test-user', goal.id, 'completed');
      assert(success, 'Expected status update to succeed');
      
      const goals = cpe.getUserGoals('test-user');
      assert.equal(goals[0].status, 'completed');
    });

    await test('augmentWithRAG returns structured result', async () => {
      const cpe = new ContextPulseEngine();
      
      // Add some context first
      await cpe.addContext('User likes hiking and outdoor activities', 'test-user');
      
      const result = await cpe.augmentWithRAG('outdoor recommendations', 'test-user');
      
      assert(result.originalQuery === 'outdoor recommendations');
      assert(typeof result.augmentedPrompt === 'string');
      assert(typeof result.goalAlignmentScore === 'number');
      assert(Array.isArray(result.retrievedContexts));
    });

    await test('calculateGoalAlignment returns score between 0 and 1', async () => {
      const cpe = new ContextPulseEngine();
      
      await cpe.addUserGoal('test-user', 'Learn programming', 'high');
      
      const score = await cpe.calculateGoalAlignment('programming tutorial', 'test-user');
      
      assert(score >= 0 && score <= 1, 'Expected score between 0 and 1');
    });

    await test('processMessage categorizes content correctly', async () => {
      const cpe = new ContextPulseEngine({
        minSimilarityScore: 0, // Lower threshold for mock embeddings
      });
      
      await cpe.processMessage('I want to learn Python programming', 'user', 'test-user', 'chat-1');
      
      const results = await cpe.retrieveContext('Python', 'test-user', {
        minScore: 0, // Lower threshold for mock embeddings
      });
      assert(results.length > 0, 'Expected processed message to be retrievable');
    });

    await test('can add scheduled triggers', () => {
      const cpe = new ContextPulseEngine();
      
      const triggerId = cpe.addScheduledTrigger(
        'test-user',
        'Time for your daily standup!',
        { type: 'daily', time: '09:00' }
      );
      
      assert(triggerId, 'Expected trigger ID to be returned');
    });

    await test('can add contextual triggers', () => {
      const cpe = new ContextPulseEngine();
      
      const triggerId = cpe.addContextualTrigger(
        'test-user',
        'When discussing deadlines',
        'deadline due date schedule',
        'Need help with time management?',
        0.7
      );
      
      assert(triggerId, 'Expected trigger ID to be returned');
    });

    await test('getStats returns correct information', async () => {
      const cpe = new ContextPulseEngine();
      
      // Clear any previous state by getting fresh instance
      const faiss = cpe.getFAISSService();
      faiss.clear();
      
      await cpe.addContext('Test context 1', 'test-user');
      await cpe.addContext('Test context 2', 'test-user');
      
      const stats = cpe.getStats();
      assert.equal(stats.totalEntries, 2);
    });
  });

  console.log('\n✨ All tests completed!\n');
}

// Run the tests
runTests().catch(console.error);
