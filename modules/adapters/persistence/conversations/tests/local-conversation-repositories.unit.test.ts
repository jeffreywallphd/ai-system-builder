import { mkdtemp } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalConversationRepositoryAdapters } from '..';

describe('local conversation repositories',()=>{it('stores technical user text safely', async()=>{const root=await mkdtemp(join(tmpdir(),'conv-')); const a=createLocalConversationRepositoryAdapters({rootDir:root}); await a.conversationMessageRepository.saveConversationMessage({id:'msg-1',workspaceId:'ws-1',conversationSessionId:'session-1',conversationTurnId:'turn-1',role:'user',contentKind:'text',text:'Use JSON and API token in command path',createdAt:'2026-01-01T00:00:00.000Z'} as any); const rows=await a.conversationMessageRepository.listConversationMessagesBySession('ws-1','session-1'); expect(rows).toHaveLength(1); expect(rows[0]?.text).toContain('JSON');});});
