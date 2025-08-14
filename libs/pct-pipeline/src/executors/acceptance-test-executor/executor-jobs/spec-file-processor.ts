/**
 * Check if multiple step definition. Expecting Structure:
 *
 * Rule: rule 1
 *
 *  Scenario : scenario 1
 *    Given given1
 *    When when1
 *    ..
 *    Then then1
 *
 * Rule: rule 2
 *
 *  Scenario : scenario 2
 *    Given text1
 *    When text2
 *    ...
 *    Then text3
 *
 * "Rule" is essential, without it parsing will not work.
 */

import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import { getDotFeatureFileContent } from '../../../lib/doc';
import { getE2eAppPath } from '../helpers';
import { AcceptanceTesterSchema } from '../schema';

export class SpecFileProcessor {
  private specFiles: string[] = [];
  constructor(private e2eAppName: string, private options: AcceptanceTesterSchema) {}

  async hasOnlyInFileList() {
    const list = await this.getSpecFilesList();
    for (const file of list) {
      const hasOnly = fs.readFileSync(file).toString().includes('@only');
      if (hasOnly) {
        return true;
      }
    }
    return false;
  }

  async checkDuplicateScenario() {
    const list = await this.getSpecFilesList();
    for (const file of list) {
      const scenarios: string[] = [];
      const doc = getDotFeatureFileContent(file);
      if (!doc.feature) continue;

      const featureChild = doc.feature.children.flat(1);
      for (const fc of featureChild) {
        if (!fc.rule || !fc.rule.children) continue;

        for (const c of fc.rule.children) {
          if (!c.scenario) continue;
          const sName = c.scenario.name;
          const searchResult = scenarios.find((s) => s === sName);
          if (searchResult) {
            throw new Error(
              `Duplicate scenario "${sName}". You might have some dangling docker containers, please stop( and prune) them, otherwise test will fail.`
            );
          }
          scenarios.push(sName);
        }
      }
    }
  }

  public getSpecFilePattern() {
    const specsFolder = this.options.documentationScreenshots ? 'screens' : 'spec';
    if (this.options.restrict != null) {
      return `${specsFolder}/${this.options.restrict}*.feature`;
    } else {
      return `${specsFolder}/*.feature`;
    }
  }

  async getSpecFilesList() {
    if (this.specFiles.length > 0) return this.specFiles;
    const pattern = this.getSpecFilePattern();
    const e2eLocation = getE2eAppPath(this.e2eAppName);
    const specFileCandidates = await glob(pattern, {
      cwd: e2eLocation,
    });
    this.specFiles = specFileCandidates.map((sf) => path.join(e2eLocation, sf)).filter((sf) => fs.statSync(sf).isFile());
    return this.specFiles;
  }
}
