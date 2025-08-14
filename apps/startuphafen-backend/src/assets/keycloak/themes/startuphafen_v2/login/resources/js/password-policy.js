const policies = {
  length: (policy, value) => {
    if (value.length < policy.value) {
      return templateError(policy);
    }
  },
  maxLength: (policy, value) => {
    if (value.length > policy.value) {
      return templateError(policy);
    }
  },
  upperCase: (policy, value) => {
    console.log(
      'filter only uppercase: ' +
        value.split('').filter((char) => char === char.toUpperCase()).length
    );
    console.log(
      'filter only not lowercase: ' +
        value.split('').filter((char) => char !== char.toLowerCase()).length
    );
    console.log(
      'filter both: ' +
        value
          .split('')
          .filter(
            (char) => char === char.toUpperCase() && char !== char.toLowerCase()
          ).length
    );
    console.log(' ');
    if (
      value
        .split('')
        .filter(
          (char) => char === char.toUpperCase() && char !== char.toLowerCase()
        ).length < policy.value
    ) {
      return templateError(policy);
    }
  },
  lowerCase: (policy, value) => {
    console.log(
      'filter only lowercase: ' +
        value.split('').filter((char) => char === char.toLowerCase()).length
    );
    console.log(
      'filter only not uppercase: ' +
        value.split('').filter((char) => char !== char.toUpperCase()).length
    );
    console.log(
      'filter both: ' +
        value
          .split('')
          .filter(
            (char) => char === char.toLowerCase() && char !== char.toUpperCase()
          ).length
    );
    console.log(' ');
    if (
      value
        .split('')
        .filter(
          (char) => char === char.toLowerCase() && char !== char.toUpperCase()
        ).length < policy.value
    ) {
      return templateError(policy);
    }
  },
  digits: (policy, value) => {
    const digits = value.split('').filter((char) => char.match(/\d/));
    if (digits.length < policy.value) {
      return templateError(policy);
    }
  },
  specialChars: (policy, value) => {
    const specialChars = value.split('').filter((char) => char.match(/\W/));
    if (specialChars.length < policy.value) {
      return templateError(policy);
    }
  },
};

const templateError = (policy) => policy.error.replace('{0}', policy.value);

export function validatePassword(password, activePolicies) {
  const errors = [];
  for (const p of activePolicies) {
    const validationError = policies[p.name](p.policy, password);
    if (validationError) {
      errors.push(validationError);
    }
  }
  return errors;
}
