import { describe, expectTypeOf, it } from 'vitest';
import type { ConversationSessionRepositoryPort } from '../conversation-session-repository.port';

describe('conversations ports',()=>{it('declares conversation session repository port',()=>{expectTypeOf<ConversationSessionRepositoryPort>().toBeObject();});});
