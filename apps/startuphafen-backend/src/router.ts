import { router } from '@startuphafen/trpc-root';
import { createWatermarkRouter } from '@startuphafen/watermark/server';
import { ServerConfig } from './config';
import { buildChatbotRouter } from './features/chatbot/chatbot-router';
import { buildCMSRouter } from './features/cms/cms-router';
import { buildBntkRouter } from './features/common/bntk-router';
import { buildExtRouter } from './features/common/external-router';
import { buildGenericMailRouter } from './features/common/generic-mail-router';
import { buildLoginRouter } from './features/common/login-router';
import { buildOZGRouter } from './features/common/ozg-router';
import { createRateLimiter } from './features/common/rate-limiter';
import { buildEricRouter } from './features/eric/eric-router';
import { buildHwkAiRouter } from './features/hwk-ai/hwk-ai-router';
import { buildHwkFormRouter } from './features/hwk-form/hwk-form-router';
import { buildIdentificationDocumentsRouter } from './features/identification-documents/identification-documents-router';
import { buildOzgInfoRouter } from './features/ozg-info/ozg-info-router';
import { buildProfileInfoRouter } from './features/profile-info/profile-info-router';
import { buildUserDocumentsRouter } from './features/user-documents/user-documents-router';
import { answerRouter } from './generic-routers/answer-router';
import { buildFeatureFlagRouter } from './generic-routers/feature-flag-router';
import { buildFeedbackRouter } from './generic-routers/feedback-router';
import { projectRouter } from './generic-routers/project-router';
import { questionTrackingRouter } from './generic-routers/questiontracking-router';
import { buildUserRouter } from './generic-routers/user-router';

// !!!! when starting to change real APIs in use by real app-version out in the wild consider how to version the API for the app
// since people may use month old app-versions we cannot just arbitrarily change the api surface.
// -> Prefer to add new APIs in case of changes instead
// !!!!

export function createAppRouter(serverConfig: ServerConfig) {
  const uploadLimiter = createRateLimiter(
    serverConfig.rateLimit.upload,
    'upload'
  );
  const chatLimiter = createRateLimiter(
    serverConfig.rateLimit.chatbot,
    'chatbot'
  );

  return router({
    WaterMark: createWatermarkRouter(serverConfig.watermarkConfig),

    OZG: buildOZGRouter(serverConfig),
    BNTK: buildBntkRouter(serverConfig),
    CMS: buildCMSRouter(serverConfig),
    QuestionTracking: questionTrackingRouter,
    Project: projectRouter,
    Answers: answerRouter,
    FeatureFlags: buildFeatureFlagRouter(),
    ChatBot: buildChatbotRouter(serverConfig, chatLimiter),
    HwkAi: buildHwkAiRouter(serverConfig),

    Eric: buildEricRouter(serverConfig),
    User: buildUserRouter(),
    Login: buildLoginRouter(serverConfig),
    Ext: buildExtRouter(serverConfig),
    HwkForm: buildHwkFormRouter(serverConfig),
    UserDocuments: buildUserDocumentsRouter(uploadLimiter),
    ProfileInfo: buildProfileInfoRouter(),
    OzgInfo: buildOzgInfoRouter(serverConfig),
    IdentificationDocuments: buildIdentificationDocumentsRouter(uploadLimiter),

    Feedback: buildFeedbackRouter(serverConfig),

    GenericMail: buildGenericMailRouter(serverConfig),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
