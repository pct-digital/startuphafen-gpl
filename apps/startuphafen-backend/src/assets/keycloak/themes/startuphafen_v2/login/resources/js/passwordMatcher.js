// Gets overwritten in register.ftl
let passwordConfirmErrorMessage;
let passwordConfirmErrorClass;

document.addEventListener('DOMContentLoaded', function () {
  const password =
    document.getElementById('password-new') ||
    document.getElementById('password');
  if (
    password !== null &&
    document.getElementById('password-confirm') !== null
  ) {
    checkPasswordMatching();
    password.addEventListener('blur', function () {
      checkPasswordMatching();
    });
    document
      .getElementById('password-confirm')
      .addEventListener('blur', function () {
        checkPasswordMatching();
      });
  }
});

function checkPasswordMatching() {
  const password =
    document.getElementById('password-new') ||
    document.getElementById('password');
  const passwordConfirm = document.getElementById('password-confirm');
  const passwordValue = password.value;
  const passwordConfirmValue = passwordConfirm.value;
  const parentDiv = document.getElementById('password-confirm-container');
  const existingError = document.getElementById('input-error-password-confirm');

  if (passwordValue !== passwordConfirmValue) {
    if (!existingError && passwordConfirmValue !== '') {
      const errorSpan = document.createElement('span');
      errorSpan.id = 'input-error-password-confirm';
      errorSpan.className = passwordConfirmErrorClass;
      errorSpan.setAttribute('aria-live', 'polite');
      errorSpan.innerHTML = passwordConfirmErrorMessage;

      parentDiv.appendChild(errorSpan);
      passwordConfirm.setAttribute('aria-invalid', 'true');
    }
  } else {
    if (existingError) {
      parentDiv.removeChild(existingError);
      passwordConfirm.setAttribute('aria-invalid', 'false');
    }
  }
}
