// Gets overwritten in register.ftl

function patternTrim(pass) {
  return pass.replace(/^\s+|\s+$/g, function (match) {
    return ``.repeat(match.length);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('password') != undefined) {
    document.getElementById('password').addEventListener('focusout', function () {
      this.value = patternTrim(this.value);
    });
  }

  if (document.getElementById('password-new') != undefined) {
    document.getElementById('password-new').addEventListener('focusout', function () {
      this.value = patternTrim(this.value);
    });
  }

  if (document.getElementById('password-confirm') != undefined) {
    document.getElementById('password-confirm').addEventListener('focusout', function () {
      this.value = patternTrim(this.value);
    });
  }
});
