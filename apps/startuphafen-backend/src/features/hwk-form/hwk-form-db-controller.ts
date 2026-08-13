import {
  Answers,
  ProfileInfo,
  Project,
  QuestionTracking,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

export class HwkFormDbController {
  constructor(private trx: Knex.Transaction) {}

  async getProjectById(projectId: number) {
    return this.trx<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .where({ id: projectId })
      .first();
  }

  async getAnswersByProjectId(projectId: number) {
    return this.trx<Answers>(STARTUPHAFENBACKEND_TABLES.ANSWERS).where({
      projectId,
    });
  }

  async getQuestionTrackingByProjectId(projectId: number) {
    return this.trx<QuestionTracking>(
      STARTUPHAFENBACKEND_TABLES.QUESTIONTRACKING
    )
      .where({ projectId })
      .orderBy('id', 'desc')
      .first();
  }

  async getUserById(userId: string) {
    return this.trx<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .where({ id: userId })
      .first();
  }

  async getProfileInfoByUserId(userId: string) {
    return this.trx<ProfileInfo>(STARTUPHAFENBACKEND_TABLES.PROFILEINFO)
      .where({ userId })
      .first();
  }

}
