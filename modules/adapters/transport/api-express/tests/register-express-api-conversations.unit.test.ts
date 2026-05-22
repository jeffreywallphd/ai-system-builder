import { describe, expect, it, testDouble } from '../../../../testing/node-test';
import { registerExpressApi } from '../registerExpressApi';

function base(app:any){ return { app,
getHuggingFaceTokenStatus:testDouble.fn(), setHuggingFaceToken:testDouble.fn(), clearHuggingFaceToken:testDouble.fn(),
storeArtifactUploadUseCase:{} as any,browseArtifactsUseCase:{} as any,readArtifactDetailUseCase:{} as any,readArtifactContentUseCase:{} as any,artifactMediaViewRetrieval:{} as any,deleteRegisteredArtifactUseCase:{} as any,hasArtifactInRepoUseCase:{} as any,browseHuggingFaceNamespaceDatasetsUseCase:{} as any,browseHuggingFaceDatasetParquetFilesUseCase:{} as any,storeArtifactInRepoUseCase:{} as any,publishArtifactToRepoUseCase:{} as any,verifyPublishedArtifactBackingUseCase:{} as any,verifyImportedArtifactSourceBackingUseCase:{} as any,registerArtifactFromRepoUseCase:{} as any,localizeArtifactFromRepoUseCase:{} as any,generateImageUseCase:{} as any,browseModelsUseCase:{} as any,getModelDetailsUseCase:{} as any,listModelsUseCase:{} as any,saveModelReferenceUseCase:{} as any,downloadModelUseCase:{} as any,updateModelRecordUseCase:{} as any,deleteModelRecordUseCase:{} as any }; }

describe('registerExpressApi conversations', ()=>{
  it('registers conversation execution routes when services provided', ()=>{
    const app={get:testDouble.fn(),post:testDouble.fn()};
    registerExpressApi({ ...base(app), conversationExecutionServices: { conversations: {
      create: { execute: testDouble.fn() }, approve: { execute: testDouble.fn() }, submitTurn: { execute: testDouble.fn() }, cancelTurn: { execute: testDouble.fn() }, retryTurn: { execute: testDouble.fn() },
      readSessions: { listSummaries: testDouble.fn(), readDetail: testDouble.fn() }, readTranscript: { readTranscript: testDouble.fn() }, readActivity: { readActivity: testDouble.fn() },
    } } } as any);
    const paths = [...app.get.mock.calls, ...app.post.mock.calls].map((c:any)=>c[0]);
    expect(paths).toContain('/api/conversations/workspaces/:workspaceId/sessions');
    expect(paths).toContain('/api/conversations/workspaces/:workspaceId/sessions/:conversationSessionId/turns');
  });
});
