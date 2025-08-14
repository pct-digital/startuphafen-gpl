import { TrpcService } from '@startuphafen/angular-common';
import {
  Catalogue,
  CatalogueAnswer,
  CatalogueQuestion,
  ShAnswers,
  ShQuestionTracking,
} from '@startuphafen/startuphafen-common';
import _ from 'lodash';

export class QuestionCatalogueHandler {
  projectID: number | null = null;
  catalogueID: string | null = null;
  completeCatalogue: Catalogue | null = null;

  catalogue: CatalogueQuestion[] = [];
  currentQuestion: CatalogueQuestion | null = null;
  questionIndex: number | null = null;
  currentStep = 0;

  previousQuestions: string[] = [];
  loadedPreviousAnswers = false;
  private constructor(
    questionCatalogue: Catalogue,
    projectID: number,
    questionTrackingResults: ShQuestionTracking[],
    private trpc: TrpcService
  ) {
    if (projectID == null) return;
    this.projectID = projectID;
    this.questionIndex = 0;
    this.catalogueID = questionCatalogue.catalogueId;
    this.catalogue = questionCatalogue.questions;
    this.completeCatalogue = questionCatalogue;
    this.currentQuestion = this.catalogue[this.questionIndex];
    this.prepareStateFromDB(questionTrackingResults);
  }

  public static async createQuestionCatalogue(
    projectID: number,
    trpc: TrpcService
  ) {
    const catalogue = await trpc.client.CMS.getQuestionCatalogue.query(
      projectID
    );
    const questionTrackingResults =
      await trpc.client.ShQuestionTracking.readFiltered.query({
        projectId: projectID,
      });
    return new QuestionCatalogueHandler(
      catalogue,
      projectID,
      questionTrackingResults,
      trpc
    );
  }

  prepareStateFromDB(questionTrackingResults: ShQuestionTracking[]) {
    if (questionTrackingResults.length === 0) return;
    for (const e of questionTrackingResults) {
      this.previousQuestions.push(e.strapiQuestionId);
    }
    const targetIndex =
      this.searchQuestion(
        questionTrackingResults[questionTrackingResults.length - 1]
          .strapiQuestionId
      ) ?? 0;
    this.currentQuestion = this.catalogue[targetIndex];
    this.questionIndex = targetIndex;
    this.currentStep = questionTrackingResults.length - 1;
    this.loadedPreviousAnswers = true;
    this.previousQuestions.pop();
  }

  async next(answerRec: CatalogueAnswer, calledByRecursion?: boolean) {
    if (
      this.questionIndex == null ||
      this.catalogue.length - 1 === this.questionIndex ||
      this.currentQuestion == null
    )
      return;
    if (!calledByRecursion) {
      this.previousQuestions.push(this.currentQuestion.questionId);
      this.currentStep += 1;
      await this.savePosition();
      await this.saveAnswers(answerRec);
    }

    this.questionIndex += 1;
    this.currentQuestion = this.catalogue[this.questionIndex];
    const validationChecked = await this.checkValidations();
    if (!validationChecked) await this.next(answerRec, true);
  }

  async previous() {
    if (
      this.questionIndex == null ||
      this.questionIndex === 0 ||
      this.currentQuestion == null
    )
      return;
    const targetIndex = this.searchQuestion(
      this.previousQuestions[this.previousQuestions.length - 1]
    );

    if (targetIndex == null) return;

    await this.deletePosition(targetIndex);
    this.previousQuestions.pop();
    this.currentQuestion = this.catalogue[targetIndex];
    this.questionIndex = targetIndex;
    this.currentStep -= 1;
  }

  async checkValidations() {
    if (this.currentQuestion == null) return;
    if (this.currentQuestion.validations == null) return;

    const keysToSearch = this.currentQuestion.validations.map(
      (e) => e.relativeQuestionId
    );
    const answerRec = (
      await this.trpc.client.ShAnswers.readFiltered.query({
        projectId: this.projectID ?? -1,
      })
    ).filter((e) => keysToSearch.includes(e.key));

    if (this.currentQuestion.validations.length === 0) return true;

    for (const validations of this.currentQuestion.validations) {
      const answeGroup = answerRec.filter(
        (e) => e.key === validations.relativeQuestionId
      );
      for (const answer of answeGroup) {
        const type = validations.ruleType.operation;
        //Check if answerIds match and skip the iteration
        if (type !== 'oneOf') {
          if (answeGroup.length > 1) {
            if (answer.strapiAnswerId !== validations.relativeAnswerId) break;
          } else {
            if (answer.strapiAnswerId !== validations.relativeAnswerId)
              return false;
          }
        }
        //switch for checking validations against given answers
        switch (type) {
          case 'eq':
            if (answer.value !== validations.ruleType.value) return false;
            break;
          case 'lt':
            if (!_.isNumber(Number(answer.value))) return false;

            if (Number(answer.value) > Number(validations.ruleType.value))
              return false;

            break;
          case 'gt':
            if (!_.isNumber(Number(answer.value))) return false;
            if (Number(answer.value) < Number(validations.ruleType.value))
              return false;
            break;
          case 'oneOf': {
            const oneOfArray = validations.ruleType.value.split('?');
            if (oneOfArray.some((e) => e === answer.value)) break;
            return false;
          }
        }
      }
    }
    return true;
  }

  searchQuestion(qID: string) {
    for (let index = 0; index < this.catalogue.length; index++) {
      if (qID === this.catalogue[index].questionId) return index;
    }
    return;
  }

  async savePosition() {
    if (
      this.questionIndex == null ||
      this.catalogue.length - 1 === this.questionIndex ||
      this.currentQuestion == null
    )
      return;

    const questionTrackingRes =
      await this.trpc.client.ShQuestionTracking.readFiltered.query({
        projectId: this.projectID ?? -1,
        strapiQuestionId: this.currentQuestion.questionId,
      });

    if (questionTrackingRes.length !== 0) return;

    await this.trpc.client.ShQuestionTracking.create.mutate({
      posIndex: this.questionIndex,
      strapiQuestionId: this.currentQuestion?.questionId ?? '',
      projectId: this.projectID ?? -1,
    });
  }

  async deletePosition(targetIndex: number) {
    if (this.currentQuestion == null) return;

    const posToDel =
      await this.trpc.client.ShQuestionTracking.readFiltered.query({
        strapiQuestionId: this.catalogue[targetIndex].questionId,
      });
    if (posToDel.length === 0) return;

    await this.trpc.client.ShQuestionTracking.delete.mutate(posToDel[0].id);
  }

  async saveAnswers(answerRec: CatalogueAnswer) {
    if (this.projectID == null || this.currentQuestion == null) return;

    for (const e of Object.keys(answerRec)) {
      for (const singleAnswer of answerRec[e]) {
        let answers: ShAnswers[] = [];
        if (
          singleAnswer.type === 'bool' ||
          singleAnswer.type === 'multi-single'
        ) {
          answers = await this.trpc.client.ShAnswers.readFiltered.query({
            key: e,
            projectId: this.projectID,
            catalogueId: this.catalogueID ?? 'ERR',
          });
        } else {
          answers = await this.trpc.client.ShAnswers.readFiltered.query({
            key: e,
            catalogueId: this.catalogueID ?? 'ERR',
            strapiAnswerId: singleAnswer.aId,
            projectId: this.projectID,
          });
        }

        if (answers.length === 0) {
          await this.trpc.client.ShAnswers.create.mutate({
            key: e,
            value: singleAnswer.value.toString(),
            catalogueId: this.catalogueID ?? 'ERR',
            projectId: this.projectID,
            type: singleAnswer.type,
            strapiAnswerId: singleAnswer.aId,
            xmlKey: singleAnswer.xmlKey,
          });
        } else {
          await this.trpc.client.ShAnswers.update.mutate({
            id: answers[0].id,
            updates: {
              value: singleAnswer.value.toString(),
              type: singleAnswer.type,
              xmlKey: singleAnswer.xmlKey,
            },
          });
        }
      }
    }
  }

  async finalize(answerRec: CatalogueAnswer) {
    if (!this.currentQuestion) return;
    await this.saveAnswers(answerRec);
    await this.savePosition();
  }
}
