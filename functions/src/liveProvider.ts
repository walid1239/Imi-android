export type LiveSessionInput = {
  sessionId: string;
  teacherUid: string;
  title: string;
  subjectId: string;
  startsAt: Date;
};

export type LiveSessionPlan = {
  provider: "mock";
  status: "mock_scheduled";
  liveEnabled: false;
  joinUrl: null;
  recordingPath: null;
};

/**
 * Provider-neutral contract boundary. This mock intentionally cannot create a
 * network room, issue participant tokens, start a broadcast, or record media.
 */
export interface LiveProviderAdapter {
  schedule(input: LiveSessionInput): Promise<LiveSessionPlan>;
}

export class MockLiveProvider implements LiveProviderAdapter {
  async schedule(_input: LiveSessionInput): Promise<LiveSessionPlan> {
    return {
      provider: "mock",
      status: "mock_scheduled",
      liveEnabled: false,
      joinUrl: null,
      recordingPath: null,
    };
  }
}

export const mockLiveProvider = new MockLiveProvider();
