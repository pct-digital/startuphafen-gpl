import { generatePage } from './eleventy';
import * as fs from 'fs';
import * as path from 'path';
import slugify from 'slugify';
import * as _ from 'lodash';

import * as Gherkin from '@cucumber/gherkin';
import * as Messages from '@cucumber/messages';
import { generateUUID } from '@startuphafen/utility';

const baseDirectory = __dirname + '/../doc-template';
const inputDirectory = __dirname + '/../doc-template/src';

function parseGherkin(gherkin: string) {
  const uuidFn = Messages.IdGenerator.uuid();
  const builder = new Gherkin.AstBuilder(uuidFn);
  const matcher = new Gherkin.GherkinClassicTokenMatcher(); // or Gherkin.GherkinInMarkdownTokenMatcher()
  const parser = new Gherkin.Parser(builder, matcher);

  const doc = parser.parse(gherkin);

  return doc;
}

export function getDotFeatureFileContent(
  filePath: string
): Messages.GherkinDocument {
  const gherkinContent = fs.readFileSync(filePath).toString();
  return parseGherkin(gherkinContent);
}

function packagePageData(specDirectory: string) {
  const files = fs.readdirSync(specDirectory);

  const docs: { file: string; object: Messages.GherkinDocument }[] = [];

  for (const file of files) {
    const filePath = path.join(specDirectory, file);
    if (fs.lstatSync(filePath).isFile()) {
      if (filePath.endsWith('.feature') || filePath.endsWith('.xfeature')) {
        const gherkinContent = fs.readFileSync(filePath).toString();
        docs.push({ file, object: parseGherkin(gherkinContent) });
      }
    } else {
      console.log(
        'Warning: e2e runner documentation generator only supports a flat specs directory for the documentation right now, will ignore content in directory: ' +
          file
      );

      // if you do not like the warning above you can use the glob library, which is already part of our dependencies,
      // to find all .feature files in subfolders quite easily!
      // the acceptance-test-executor uses it for that, too
    }
  }

  const noRuleScenarios = (doc: Messages.GherkinDocument) =>
    doc.feature?.children
      .filter((c) => c.scenario != null)
      .map((c) => c.scenario);

  const summarizeScenario = (
    scenario: Messages.Scenario,
    fileIsImplemented: boolean
  ) => {
    const slugName = slugify(scenario.name);

    const examples: any[] = [];

    for (const example of scenario.examples) {
      const headers = example.tableHeader?.cells.map((c) => c.value);

      if (headers != null) {
        let index = 0;
        for (const row of example.tableBody.map((b) =>
          b.cells.map((c) => c.value)
        )) {
          index++;
          const ex: any = [];
          for (let hi = 0; hi < headers.length; hi++) {
            const key = headers[hi];
            const value = row[hi];
            ex.push({
              key,
              value,
            });
          }

          examples.push({
            videoPath: slugName + '-(example-' + (examples.length + 1) + ')',
            id: generateUUID(),
            index,
            values: ex,
          });
        }
      }
    }

    const name = scenario.keyword + ': ' + scenario.name;
    const tab = ' ';

    return {
      id: generateUUID(),
      name,
      slugName,
      isImplemented:
        fileIsImplemented &&
        !scenario.tags.map((t) => t.name).includes('@ignore'),
      videoPath: slugName,
      steps: scenario.steps
        .map((s) => tab + s.keyword.trim() + ' ' + s.text.trim())
        .filter((x) => x.length > 0)
        .join('\n'),
      hasExamples: scenario.examples.length > 0,
      firstExample: examples.length > 0 ? examples[0].id : '',
      examples,
    };
  };

  const packRules = (doc: Messages.GherkinDocument, file: string) => {
    const result: any[] = [];

    const noRule = noRuleScenarios(doc)?.map((x) => {
      if (x == null) return;
      return summarizeScenario(x, file.endsWith('.feature'));
    });
    if (noRule != null && noRule.length > 0) {
      result.push({
        rule: '',
        scenarios: noRule,
      });
    }

    const rules = doc.feature?.children
      .filter((c) => c.rule != null)
      .map((c) => c.rule);

    if (rules != null) {
      for (const rule of rules) {
        const scenarios = rule?.children
          .filter((x) => x.scenario != null)
          .map((x) => {
            if (x.scenario == null) return;
            return summarizeScenario(x.scenario, file.endsWith('.feature'));
          });
        const ruleIgnored = rule?.tags.map((t) => t.name).includes('@ignore');
        if (ruleIgnored && scenarios != null) {
          for (const scenario of scenarios) {
            if (scenario != null) scenario.isImplemented = false;
          }
        }
        result.push({
          rule: rule?.name,
          scenarios,
        });
      }
    }

    return result;
  };

  const features = docs.map((doc) => {
    const rules = packRules(doc.object, doc.file);

    return {
      name: doc.object.feature?.name.trim(),
      description: doc.object.feature?.description.trim(),
      file: slugify(doc.file),
      isIncomplete:
        rules.find(
          (r) => r.scenarios.find((s: any) => !s.isImplemented) != null
        ) != null,
      rules,
    };
  });

  features.sort((a, b) => {
    const an = a.name?.split(' ')[0].replace('F', '');
    const bn = b.name?.split(' ')[0].replace('F', '');
    return Number(an) - Number(bn);
  });

  //   console.log('features', JSON.stringify(features, undefined, 2));

  return { features };
}

export async function buildEleventyDoc(
  specDirectory: string,
  outputDirectory: string,
  versionInfo?: string
) {
  console.log('Will build documentation in ' + outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });

  const pageData = packagePageData(specDirectory);

  await generatePage({
    inputDataMap: { ...pageData, version: versionInfo },
    inputDirectory,
    outputDirectory,
    passthrough: {
      srcBaseDir: baseDirectory,
      inputs: ['fonts', 'img', 'style.css', 'prismjs'],
    },
  });
}
