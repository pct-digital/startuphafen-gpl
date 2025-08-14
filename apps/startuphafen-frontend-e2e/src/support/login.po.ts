export class LoginPage {
  public static mockLoginTexts() {
    cy.intercept('GET', '/trpc/CMS.getSingleTypeData', {
      data: {
        data: {
          title: 'Test',
          subtitle: 'Test',
          content: 'Test',
          loginButton: 'Test',
          registerButton: 'Test',
        },
      },
    });
  }
}
