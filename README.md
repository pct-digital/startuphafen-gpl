# Startuphafen

Startuphafen is a webapplication designed to help users navigate the german company application process. It mainly provides a questionnaire, of which it creates a request that is sent to ERiC / Elster and the OZG-Cloud provider.

# Deployment System

Read the separate [README](tools/deploy3/README.md)

## Dev Logins (Keycloak devcontainer realm)

The local Keycloak instance imports a development realm with three seeded
users (dev environment only — never reuse these anywhere):

| Username | Password | Purpose                                             |
| -------- | -------- | --------------------------------------------------- |
| admin    | admin    | Realm admin + application admin (`startuphafen-admin`) |
| alice    | alice    | Activated standard user                              |
| marie    | marie    | Fresh user without activation (first-login flows)    |

## Dev Ports

- caddy proxy: 4000 (use for development)
- angular: 4201
- express-backend: 5000
- pg_admin: 3838
- kc-admin: 4000/kc-admin
- keycloak (direct): 28080
- maildev: 1080

## General Concepts

### tRPC

For typesafe communication between frontend and backend this project uses tRPC. TRPC Routers are imported into the **apps/startuphafen-backend/src/router.ts** and need to be manually created. Routers have a security measure by which only certain users with specified roles are allowed to access these endpoints. The roles are **anon, login, bundID-low, bundID-high** and increase in severity left to right. The roles are specified in the meta tag of the route.

```ts
 hello: shRoute
      .meta({
        requiredRolesAny: ['login'],
      })
      .output(z.string())
      .query(async () => {
        return 'Hello World';
      }),
```

The tRPC-Client service used from the frontend is located in the angular common library. To modify the middleware used by tRPC locate the trpc-root library.

### Angular

Angular components are separated by feature and split into display and container components. Most logic should be done in the container.component.ts

```
>feature_1
  >f1_container
    >f1-container.component.ts
    >f1-container.component.spec.ts
    >f1-container.component.html
  >f1_display
    >f1-display.component.ts
    >f1-display.component.spec.ts
    >f1-display.component.html
```

## External services

When setting up, external services (like strapi or eric) won't work in the dev environment without creating a config for it.

Create a file named **.localConfigs.json** at apps/startuphafen-backend/src/assets

```json
{
  "strapi": { "host": "", "token": "" },
  "eric": { "host": "", "token": "", "finanzaemter": [ { "name": "", "bufaNr": "", "jurisdiction": "" } ] },
  "ozg": {
    "host": "",
    "control": {
      "zustaendigeStelle": "",
      "leikaIds": [],
      "formId": "",
      "name": "",
      "serviceKonto": {
        "type": "",
        "trustLevel": "",
        "postfachAddress": {
          "identifier": "",
          "type": ""
        }
      }
    }
  },
  "mistral": {
    "apiKey": ""
  }
}
```

Make sure that the file is in the .gitignore!

The file will be automatically created during deploy.

The needed API-Token can be found your strapi instance and has to be created.

The MistralAI Api-Token can be created on the MistralAI website in your organization's project.

## Prisma

In this project we use Prisma for managing database migrations.
Prisma at its core is an ORM so it uses its own schema language to map database objects to their own model types.
The schema file can be found under **apps/startuphafen-backend/src/assets/prisma/schema.prisma**.

## Quickstart

To start development you need the Dev Containers Visual Studio Code Extension from microsoft. Build the devcontainer from scratch and your workspace is good to go.

To set up strapi properly reference the following zod-types in **libs/startuphafen-common/src/lib/entities.ts**. These have to be created and filled accordingly with data to make the application work.

StrapiType
ArticleCategory
ArticleIcon
Artikel
FAQItem
Faq
Contact
WebsiteText
LoginPageTexts
CatalogueQuestion as Questions
Catalogue as QuestionCatalogue

To use strapi either setup a strapi instance locally or on an external server by using the official Strapi documentation.
Strapi questions have to be setup in the Questions Collection. The QuestionCatalogue contains relations to the needed questions in order of appearance inside the application. Refer to the official ERiC documentation on their content and their requirements and ideally consult with a tax advisor.

For legal reasons we can't provide the ERiC gateway itself. It needs to be created with a valid certificate from ELSTER. Use the npm package koffi to create a mapper between JS and C to call the ERiC-library. Create an endpoint called /makeEricCall in the gateway that accepts an input of type EricHandleProcessInput (found in **libs/startuphafen-common/src/lib/entities.ts**) to make the necessary call to ERiC. Further information can be obtained from ELSTER, requirement is a Developer Account from ELSTER. Please contact ELSTER to get started on that front. We can't provide any further information on that part.

For local development with ERiC, copy the eric-gateway into the devcontainer at root or setup a docker container within the same network as the others of the devcontainer.

OZG is a standard REST API. The parameters for the url are referenced in the official OZG Documentation. The payload request needs to of type FormDataNode[] (found in **libs/startuphafen-common/src/lib/entities.ts**). Depending on your region OZG might not be viable solution, and you need to find an alternative.

Connecting directly via BundID is nearly impossible. The common approach is to use a BundID intermediary, such as OpenRathaus or Dataport. This repository already includes a preconfigured Keycloak setup in which Dataport is registered as a BundID IdentityProvider located in **apps/startuphafen-backend/src/assets/keycloak/templates/realm.json**. Note that the local keycloak instance, used in development, uses a different realm.json located in **.devcontainer/keycloak/imports/startuphafen.json**. The variable values must be replaced (at deploy time) with the correct values provided by Dataport.

To run locally use the npm scripts `front` and `back`.

### Pitfalls

- Only edit the prisma SQL migration files manually in exceptional circumstances, _know what you're doing_ if you do.

### Creating a new Database Migration

1. navigate to the schema file
2. create or edit prisma models according to their standard (https://www.prisma.io/docs/orm/prisma-schema/data-model/models)
3. create a db migration
   - run `npx prisma migrate dev --name [migration name here]` to apply the changes in the prisma schema file to the database and create a new migration from it
   - or run `npx prisma db push` to prototype your schema changes locally without creating a new migration file
   - to reset a db push migration run `npx prisma migrate reset`
4. run `npx nx run startuphafen-backend:entities` to create entitites from the newly created db entities

## Open source release notes

This repository is the open source release of the Startuphafen project. A few
things intentionally differ from the production deployment:

- **AI knowledge base ships empty.** The chatbot and the HWK pre-check
  (KI-Prüfung) require an embeddings corpus in the `VectorEmbedding` table.
  The production corpus is built from licensed third-party documents and is
  not part of this repository. Build your own corpus with
  `tools/pdf-embeddings-generator.js` and configure the source paths in
  `apps/startuphafen-backend/src/features/common/vector-store.ts`.
- **LLM system prompts are generic placeholders.** The production prompts are
  confidential. Adapt the placeholders in
  `apps/startuphafen-backend/src/features/chatbot/constants.ts` and
  `apps/startuphafen-backend/src/features/hwk-ai/constants.ts`.
- **The official HWK application form is not included.** The HWK mail feature
  fills the official "Antrag auf Eintragung" PDF of the Handwerkskammer,
  which we cannot redistribute. This repository ships a synthetic placeholder
  form with identical form field names at
  `apps/startuphafen-backend/src/assets/forms/hwk_antrag_eintragung.pdf` -
  replace it with the official form from your local Handwerkskammer.
- **The PLZ mapping contains placeholder entries only.** Fill
  `apps/startuphafen-backend/src/assets/plz-mapping/plz-mapping.json` with
  the municipalities relevant to your deployment.

## License

This project is licensed under the GNU General Public License, version 3.
See [COPYING](COPYING) for the full license text and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for bundled third-party
assets and code.
