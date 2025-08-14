import { router } from '@startuphafen/trpc-root';
import { createWatermarkRouter } from '@startuphafen/watermark/server';
import { z } from 'zod';
import { LocalSecrets, ServerConfig } from './config';
import { buildCMSRouter } from './features/cms/cms-router';
import { buildLoginRouter } from './features/common/login-router';
import { buildOZGRouter } from './features/common/ozg-router';
import { buildEricRouter } from './features/eric/eric-router';
import { answersRouter } from './generic-routers/answer-router';
import { flagTrackingRouter } from './generic-routers/flag-tracking-router';
import { projectRouter } from './generic-routers/project-router';
import { questionTrackingRouter } from './generic-routers/question-tracking-router';
import { shAnswerRouter } from './generic-routers/sh-answers-router';
import { shProjectRouter } from './generic-routers/sh-project-router';
import { shQuestionTrackingRouter } from './generic-routers/sh-questiontracking-router';
import { buildUserRouter } from './generic-routers/user-router';
import { shRoute } from './sh-route';

// !!!! when starting to change real APIs in use by real app-version out in the wild consider how to version the API for the app
// since people may use month old app-versions we cannot just arbitrarily change the api surface.
// -> Prefer to add new APIs in case of changes instead
// !!!!

export function createAppRouter(
  serverConfig: ServerConfig,
  localSecrets: LocalSecrets
) {
  return router({
    hello: shRoute
      .meta({
        requiredRolesAny: ['login'],
      })
      .input(z.string())
      .output(z.string())
      .query(async (req) => {
        console.log('Hello called by subject ' + req.ctx.token?.sub);
        return 'Hello ' + req.ctx.token?.preferred_username;
      }),

    WaterMark: createWatermarkRouter(serverConfig.watermarkConfig),

    OZG: buildOZGRouter(localSecrets),
    Project: projectRouter,
    QuestionTracking: questionTrackingRouter,
    Answers: answersRouter,
    CMS: buildCMSRouter(localSecrets),
    FlagTracking: flagTrackingRouter,
    ShQuestionTracking: shQuestionTrackingRouter,
    ShProject: shProjectRouter,
    ShAnswers: shAnswerRouter,

    Eric: buildEricRouter(serverConfig, localSecrets),
    User: buildUserRouter(),
    Login: buildLoginRouter(serverConfig),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
