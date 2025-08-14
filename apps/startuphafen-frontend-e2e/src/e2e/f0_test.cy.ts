import { defineStep } from '@badeball/cypress-cucumber-preprocessor';

describe('S0 Die Tests starten', () => {
  defineStep('Die Tests werden ausgeführt', () => {
    cy.intercept('/').as('root');
    cy.visit('/');
    cy.wait('@root');
    cy.url().should('include', 'login');
  });
});
